import browser from 'webextension-polyfill';

import {BaseUrls, DefaultBaseUrlKey, isAllowedBaseUrlKey} from '../constants';

/**
 * OAuth 2.0 Authorization Code + PKCE against the Laravel dashboard.
 *
 * This must run in the background service worker. The popup cannot host the
 * flow: `launchWebAuthFlow` opens a window that takes focus, which closes the
 * popup and tears down the promise mid-flight. Content scripts cannot reach
 * `browser.identity` at all. Both therefore ask the background worker to run it
 * (see `source/shared/messages.ts`).
 *
 * The browser intercepts the redirect to `identity.getRedirectURL()` — for
 * Chrome `https://<extension-id>.chromiumapp.org/`, for Firefox
 * `https://<uuid>.extensions.allizom.org/` — closes the auth window and hands
 * the final URL back to the extension alone. Nothing is ever navigated to, so
 * unlike the previous `options.html` landing page there is no web-reachable
 * surface for a site to drive.
 *
 * PKCE (RFC 7636) is what makes a client secret unnecessary, which matters
 * because an extension cannot keep one: the bundle is readable by anyone who
 * installs it. The verifier never leaves this module's closure, so an
 * intercepted authorization code is useless on its own.
 */

/** Public client — no secret. Passport's PKCE grant is what authorises us. */
const RESPONSE_TYPE = 'code';
const CODE_CHALLENGE_METHOD = 'S256';

/**
 * Refresh slightly before the server-side expiry so an in-flight request does
 * not race the clock. Also covers modest clock skew between browser and server.
 */
const EXPIRY_SKEW_SECONDS = 60;

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds, already adjusted by EXPIRY_SKEW_SECONDS. */
  expiresAt: number;
}

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const randomUrlSafeString = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  return base64UrlEncode(bytes);
};

/**
 * S256 challenge. Plain is deliberately not supported — it offers no protection
 * against an attacker who can observe the authorization request.
 */
const deriveCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );

  return base64UrlEncode(new Uint8Array(digest));
};

/**
 * Length-independent comparison, so a mismatching `state` cannot be recovered
 * byte-by-byte from timing. The values are single-use and short-lived, making
 * this close to paranoia, but the correct comparison costs nothing.
 */
const constantTimeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
};

const resolveDeployment = (urlKey: string) => {
  const key = isAllowedBaseUrlKey(urlKey) ? urlKey : DefaultBaseUrlKey;
  const deployment = BaseUrls[key];

  if (!deployment?.oauth_client_id) {
    throw new Error(
      `No oauth_client_id configured for '${key}'. Register the extension as a ` +
        `PKCE public client on that dashboard and set oauth_client_id in ` +
        `witty.config.json — see AUTH_SECURITY_PLAN.md.`
    );
  }

  return {key, deployment};
};

const tokensFromResponse = (payload: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}): OAuthTokens => {
  if (!payload.access_token) {
    throw new Error('Token endpoint returned no access_token');
  }

  // Treat a missing expires_in as "already stale" rather than "never expires":
  // a token we wrongly believe is fresh fails closed on the next API call,
  // whereas one we wrongly believe is eternal would never be refreshed.
  const lifetime = Math.max(0, (payload.expires_in ?? 0) - EXPIRY_SKEW_SECONDS);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
    expiresAt: Date.now() + lifetime * 1000,
  };
};

const postToTokenEndpoint = async (
  dashboard: string,
  body: Record<string, string>
): Promise<OAuthTokens> => {
  const response = await fetch(new URL('oauth/token', dashboard).toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Token endpoint responded ${response.status} ${response.statusText}`
    );
  }

  return tokensFromResponse(await response.json());
};

/**
 * Run the interactive sign-in flow. Resolves with tokens, or rejects — callers
 * decide how to surface failure. Returns `null` only when the user closed the
 * auth window, which is a cancellation rather than an error.
 */
export const authorize = async (
  urlKey: string,
  register = false
): Promise<OAuthTokens | null> => {
  const {deployment} = resolveDeployment(urlKey);
  const redirectUri = browser.identity.getRedirectURL();

  // Both stay in this closure for the lifetime of the flow. Keeping them out of
  // extension storage means a second, concurrent flow cannot clobber them and
  // nothing persists if the flow is abandoned.
  const codeVerifier = randomUrlSafeString(32);
  const state = randomUrlSafeString(16);

  const authorizeUrl = new URL('oauth/authorize', deployment.dashboard);
  authorizeUrl.searchParams.set('client_id', deployment.oauth_client_id);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', RESPONSE_TYPE);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set(
    'code_challenge',
    await deriveCodeChallenge(codeVerifier)
  );
  authorizeUrl.searchParams.set('code_challenge_method', CODE_CHALLENGE_METHOD);
  if (register) {
    // A hint for the dashboard's own login redirect; Passport ignores unknown
    // params, so this is inert if the dashboard chooses not to honour it.
    authorizeUrl.searchParams.set('register', '1');
  }

  let redirectResult: string | undefined;
  try {
    redirectResult = await browser.identity.launchWebAuthFlow({
      url: authorizeUrl.toString(),
      interactive: true,
    });
  } catch (error) {
    // Chrome rejects with "The user did not approve access" when the auth
    // window is dismissed. That is a cancellation, not a failure worth
    // reporting to the user as an error.
    const message = error instanceof Error ? error.message : String(error);
    if (
      /did not approve|canceled|cancelled|closed by the user/i.test(message)
    ) {
      return null;
    }
    throw error;
  }

  if (!redirectResult) {
    return null;
  }

  // Only ever parse a URL the browser confirms is *our* redirect target.
  if (!redirectResult.startsWith(redirectUri)) {
    throw new Error('Authorization redirected to an unexpected URL');
  }

  const returned = new URL(redirectResult);
  const error = returned.searchParams.get('error');
  if (error) {
    throw new Error(
      `Authorization denied: ${
        returned.searchParams.get('error_description') || error
      }`
    );
  }

  const returnedState = returned.searchParams.get('state') ?? '';
  if (!constantTimeEquals(returnedState, state)) {
    // Either a stale response from an abandoned flow or a forged callback.
    // Discard the code without redeeming it.
    throw new Error('Authorization state mismatch — discarding response');
  }

  const code = returned.searchParams.get('code');
  if (!code) {
    throw new Error('Authorization returned no code');
  }

  return postToTokenEndpoint(deployment.dashboard, {
    grant_type: 'authorization_code',
    client_id: deployment.oauth_client_id,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code,
  });
};

/**
 * Exchange a refresh token for a fresh pair. Passport rotates refresh tokens,
 * so the caller must persist *both* returned values — continuing to present the
 * old refresh token after a successful rotation will fail.
 */
export const refresh = async (
  urlKey: string,
  refreshToken: string
): Promise<OAuthTokens> => {
  const {deployment} = resolveDeployment(urlKey);

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  return postToTokenEndpoint(deployment.dashboard, {
    grant_type: 'refresh_token',
    client_id: deployment.oauth_client_id,
    refresh_token: refreshToken,
  });
};

/** True when the access token is absent or within the skew window of expiry. */
export const isExpired = (expiresAt: number | undefined): boolean =>
  !expiresAt || Date.now() >= expiresAt;
