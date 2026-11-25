import {
  DefaultBaseUrlKey,
  getAuthMode,
  isAllowedBaseUrlKey,
  isStoredEndpointConfigured,
  registerCustomEndpointFromStorage,
  resolveBaseUrl,
  STATIC_ACCESS_TOKEN,
  StorageKeys,
  X_KEY,
} from '../constants';
import {getStorage} from '../platform/storage';
import {readTokens} from '../tokenStore';
import {isExpired, refresh} from './oauth';

/** How long sign-out waits for the dashboard before clearing tokens anyway. */
export const REVOKE_TIMEOUT_MS = 3000;

/**
 * Ask `dashboard` to revoke an access token and its refresh tokens. Best
 * effort: it resolves whatever happens, and gives up after `signal`.
 */
export const revokeAccessToken = async (
  dashboard: string,
  accessToken: string,
  signal: AbortSignal = AbortSignal.timeout(REVOKE_TIMEOUT_MS)
): Promise<void> => {
  try {
    await fetch(new URL('api/user/revoke-token', dashboard), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
  } catch (error) {
    // Offline, timed out, refused or an older dashboard: the tokens are
    // cleared locally either way, and none of these is worth a report.
  }
};

/**
 * Ask the dashboard to revoke the stored access token and its refresh tokens
 * (`POST api/user/revoke-token`, answered with 204).
 *
 * Best effort: it resolves whatever happens (offline, a dashboard without the
 * route, a timeout), because sign-out must clear the local tokens regardless.
 * An expired access token is refreshed once first, since the dashboard only
 * accepts a valid one; the new pair is revoked instead and never stored.
 *
 * Sends nothing while the stored endpoint key is unknown: the tokens belong to
 * that other endpoint, not to the default (storedEndpoint.ts).
 */
export const revokeStoredTokens = async (): Promise<void> => {
  if (X_KEY) return;

  try {
    const result = await getStorage().local.get([
      StorageKeys.API_ENDPOINT_KEY,
      StorageKeys.CUSTOM_ENDPOINT,
      StorageKeys.AUTH_MODE,
    ]);
    if (
      getAuthMode(result) === 'apiKey' ||
      !isStoredEndpointConfigured(result)
    ) {
      return;
    }
    registerCustomEndpointFromStorage(result);
    const urlKey =
      (result[StorageKeys.API_ENDPOINT_KEY] as string) || DefaultBaseUrlKey;
    if (!isAllowedBaseUrlKey(urlKey)) return;

    const stored = await readTokens();
    let {accessToken} = stored;
    if (STATIC_ACCESS_TOKEN && accessToken === STATIC_ACCESS_TOKEN) return;

    const deadline = AbortSignal.timeout(REVOKE_TIMEOUT_MS);
    if ((!accessToken || isExpired(stored.expiresAt)) && stored.refreshToken) {
      accessToken = await Promise.race([
        refresh(urlKey, stored.refreshToken).then(
          (tokens) => tokens.accessToken
        ),
        new Promise<string>((resolve) =>
          deadline.addEventListener('abort', () => resolve(''))
        ),
      ]);
    }
    if (!accessToken || deadline.aborted) return;

    await revokeAccessToken(
      resolveBaseUrl(urlKey).dashboard,
      accessToken,
      deadline
    );
  } catch (error) {
    // Offline, timed out, refused or an older dashboard: the tokens are
    // cleared locally either way, and none of these is worth a report.
  }
};
