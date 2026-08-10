import browser from 'webextension-polyfill';

import {StorageKeys} from './constants';
import {OAuthTokens} from './ApiServices/oauth';
import {getStorage, StorageArea} from './platform/storage';

/**
 * Single place where OAuth tokens are persisted and read back.
 *
 * Split across two storage areas on purpose:
 *
 * - **access token → `storage.session`.** In-memory only, never written to
 *   disk, and cleared when the browser exits. This is the bearer credential, so
 *   keeping it off disk is the point of the split.
 * - **refresh token + expiry → `storage.local`.** These must survive a browser
 *   restart, otherwise every launch would force an interactive sign-in.
 * - **a `signedIn` boolean → `storage.local`.** Not a secret, and it lets the
 *   many "is the user signed in?" checks and `onChanged` listeners keep working
 *   off a plain `storage.local.get(null)` snapshot. Without it, roughly ten call
 *   sites would each have to become an async two-area read for no security
 *   gain — the flag reveals nothing the badge text doesn't already.
 *
 * `storage.session` needs Chrome 102+ / Firefox 115+, so every access goes
 * through `sessionArea()`, which falls back to `local` on older browsers. The
 * fallback is a functional degradation, not a correctness one.
 */

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const sessionArea = (): StorageArea =>
  getStorage().session || getStorage().local;

const usingSessionStorage = (): boolean => !!getStorage().session;

/**
 * Let content scripts read `storage.session`.
 *
 * Chrome defaults the session area to TRUSTED_CONTEXTS, which excludes content
 * scripts — and the popover and content script both need the bearer token to
 * call the API. Call this once from the background service worker. Content
 * scripts are isolated worlds, so page JavaScript still cannot reach it; this
 * grants no more access than `storage.local` already had.
 *
 * `setAccessLevel` is a Chrome-specific extension of `storage.session` that
 * `WittyStorage` deliberately does not model (it has no equivalent for a
 * non-extension host), so this one call goes straight through
 * webextension-polyfill rather than through `getStorage()`.
 */
export const allowSessionStorageInContentScripts = async (): Promise<void> => {
  const session = (browser.storage as any).session;
  if (!session?.setAccessLevel) {
    return;
  }

  try {
    await session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    });
  } catch (error) {
    // Older Chromium builds reject the call; the fallback path still works.
  }
};

export const persistTokens = async (tokens: OAuthTokens): Promise<void> => {
  await sessionArea().set({
    [StorageKeys.ACCESS_TOKEN]: tokens.accessToken,
  });

  await getStorage().local.set({
    [StorageKeys.REFRESH_TOKEN]: tokens.refreshToken,
    [StorageKeys.ACCESS_TOKEN_EXPIRES_AT]: tokens.expiresAt,
    [StorageKeys.SIGNED_IN]: !!tokens.accessToken,
  });
};

export const readTokens = async (): Promise<StoredTokens> => {
  const [session, local] = await Promise.all([
    sessionArea().get(StorageKeys.ACCESS_TOKEN),
    getStorage().local.get([
      StorageKeys.ACCESS_TOKEN,
      StorageKeys.REFRESH_TOKEN,
      StorageKeys.ACCESS_TOKEN_EXPIRES_AT,
    ]),
  ]);

  // The local read is the migration path for installs that stored the access
  // token on disk before this split, and the fallback when session storage is
  // unavailable. Both resolve on the next refresh, which writes to session.
  return {
    accessToken:
      (session[StorageKeys.ACCESS_TOKEN] as string) ||
      (local[StorageKeys.ACCESS_TOKEN] as string) ||
      '',
    refreshToken: (local[StorageKeys.REFRESH_TOKEN] as string) || '',
    expiresAt: (local[StorageKeys.ACCESS_TOKEN_EXPIRES_AT] as number) || 0,
  };
};

export const readAccessToken = async (): Promise<string> =>
  (await readTokens()).accessToken;

export const clearTokens = async (): Promise<void> => {
  await sessionArea().set({[StorageKeys.ACCESS_TOKEN]: ''});

  await getStorage().local.set({
    [StorageKeys.ACCESS_TOKEN]: '',
    [StorageKeys.REFRESH_TOKEN]: '',
    [StorageKeys.ACCESS_TOKEN_EXPIRES_AT]: 0,
    [StorageKeys.SIGNED_IN]: false,
  });
};

/**
 * One-time cleanup for installs upgrading from the version that kept the access
 * token in `storage.local`. Moves it into session and scrubs the on-disk copy,
 * so an existing session is not dropped but the token stops living on disk.
 */
export const migrateAccessTokenOffDisk = async (): Promise<void> => {
  if (!usingSessionStorage()) {
    return;
  }

  const local = await getStorage().local.get([
    StorageKeys.ACCESS_TOKEN,
    StorageKeys.SIGNED_IN,
  ]);
  const onDisk = (local[StorageKeys.ACCESS_TOKEN] as string) || '';

  if (!onDisk) {
    return;
  }

  await sessionArea().set({[StorageKeys.ACCESS_TOKEN]: onDisk});
  await getStorage().local.set({
    [StorageKeys.ACCESS_TOKEN]: '',
    [StorageKeys.SIGNED_IN]: true,
  });
};
