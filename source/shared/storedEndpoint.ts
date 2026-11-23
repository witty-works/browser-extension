import {
  DefaultBaseUrlKey,
  isStoredEndpointConfigured,
  registerCustomEndpointFromStorage,
  StorageKeys,
  StoredApiKey,
} from './constants';
import {clearTokens} from './tokenStore';
import {sendErrorToSentry} from './errorUtils';
import {getStorage, StorageChange} from './platform/storage';

/**
 * Reset a stored endpoint key that names no configured endpoint, and drop the
 * credentials stored with it.
 *
 * A key can name nothing when it was written by another build (a 'Local' from
 * a development build, an endpoint a later config dropped) or when it is
 * 'Custom' and the custom endpoint lost its API URL. The stored access token,
 * refresh token and API key were issued for that endpoint, so they must not be
 * presented to the build default the key would otherwise fall back to.
 *
 * Runs in the background only: at start-up, whenever the endpoint key or the
 * custom endpoint changes, and before a sign-in. One owner means one Sentry
 * report and no two contexts writing the reset at once. The other contexts do
 * not wait for it: they check `isStoredEndpointConfigured` themselves and send
 * no credentials while the key is unknown (`setBaseUrls`, `apiKeyFromStorage`,
 * `getNewAccessToken`, `makeAuthRequest`).
 *
 * The credentials are cleared before the key is reset. In the other order there
 * would be a moment when storage held the default key together with the old
 * credentials, and a context reading it then would send them to the default.
 *
 * Resolves with the endpoint key in use afterwards. An unset key keeps meaning
 * the build default and is left as it is.
 */
const sanitize = async (): Promise<string> => {
  const result = await getStorage().local.get([
    StorageKeys.API_ENDPOINT_KEY,
    StorageKeys.CUSTOM_ENDPOINT,
    StorageKeys.API_KEY,
  ]);
  registerCustomEndpointFromStorage(result);

  const key = result[StorageKeys.API_ENDPOINT_KEY] as string | undefined;
  if (isStoredEndpointConfigured(result)) {
    return key || DefaultBaseUrlKey;
  }

  // Only the key goes into the report: it is a name from the build config or
  // 'Custom', never a URL or a credential.
  sendErrorToSentry(
    new Error(
      `The stored endpoint '${String(key)}' is not configured; its credentials were cleared.`
    )
  );

  await clearTokens();

  const apiKey = result[StorageKeys.API_KEY] as StoredApiKey | undefined;
  const apiKeyBelongsHere = !!apiKey?.value && apiKey.endpoint === key;

  await getStorage().local.set({
    ...(apiKeyBelongsHere
      ? {
          [StorageKeys.API_KEY]: {endpoint: '', value: ''},
          // Without its key, API-key mode would leave the user signed out with
          // no way to sign in; the default endpoint offers account sign-in.
          [StorageKeys.AUTH_MODE]: 'account',
        }
      : {}),
    [StorageKeys.CHECK_ENDPOINT_SUCCESS]: false,
  });

  await getStorage().local.set({
    [StorageKeys.API_ENDPOINT_KEY]: DefaultBaseUrlKey,
  });

  return DefaultBaseUrlKey;
};

let pending: Promise<string> = Promise.resolve(DefaultBaseUrlKey);

/**
 * Serialised, so a start-up run, a storage change and a sign-in that overlap do
 * not each see the unknown key and report it.
 */
export const sanitizeStoredEndpoint = (): Promise<string> => {
  pending = pending.catch(() => DefaultBaseUrlKey).then(sanitize);
  return pending;
};

/** Run `sanitizeStoredEndpoint` when the endpoint key or custom endpoint changes. */
export const sanitizeStoredEndpointOnChange = (
  changes: StorageChange
): void => {
  if (
    StorageKeys.API_ENDPOINT_KEY in changes ||
    StorageKeys.CUSTOM_ENDPOINT in changes
  ) {
    sanitizeStoredEndpoint().catch(sendErrorToSentry);
  }
};
