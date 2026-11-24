import {
  apiKeyFromStorage,
  DefaultBaseUrlKey,
  isDashboardAvailable,
  isStoredEndpointConfigured,
  registerCustomEndpointFromStorage,
  resolveBaseUrl,
  StorageKeys,
  X_KEY,
} from '../shared/constants';
import {
  CHECK_PATH,
  credentialHeaders,
  isTokenRefused,
  JSON_HEADERS,
  LLM_SUGGESTION_TIMEOUT_MS,
  REPHRASE_PATH,
} from '../shared/ApiServices/requests';
import {ApiRequestMessage, ApiResponse} from '../shared/messages';
import {getStorage} from '../shared/platform/storage';
import {readTokens} from '../shared/tokenStore';
import {getNewAccessToken} from '../shared/utils';

/** How long a check or auth request may take before it counts as failed. */
const REQUEST_TIMEOUT_MS = 30_000;

interface Target {
  url: string;
  method: 'POST' | 'PUT';
  body?: string;
  timeout: number;
}

/** Where each kind of request goes. The content script cannot pick a URL. */
const targetFor = (
  message: ApiRequestMessage,
  urlKey: string | undefined
): Target => {
  const {api, dashboard} = resolveBaseUrl(urlKey);
  switch (message.kind) {
    case 'check':
      return {
        url: `${api}${CHECK_PATH}`,
        method: 'POST',
        body: JSON.stringify(message.body),
        timeout: REQUEST_TIMEOUT_MS,
      };
    case 'rephrase':
      return {
        url: `${api}${REPHRASE_PATH}`,
        method: 'POST',
        body: JSON.stringify(message.body),
        timeout: LLM_SUGGESTION_TIMEOUT_MS,
      };
    case 'auth':
      return {
        url: `${api}v2.0/auth`,
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
      };
    case 'ignoreWord':
      return {
        url: `${dashboard}api/user/language/ignore-words?${new URLSearchParams({
          false_positive: message.term ?? '',
        })}`,
        method: 'PUT',
        timeout: REQUEST_TIMEOUT_MS,
      };
  }
};

const noResponse = (statusText: string): ApiResponse => {
  return {
    ok: false,
    status: 0,
    statusText,
    data: null,
  };
};

const send = async (
  target: Target,
  credentials: {apiKey?: string; token?: string}
): Promise<ApiResponse> => {
  let response: Response;
  try {
    response = await fetch(target.url, {
      method: target.method,
      headers: {...JSON_HEADERS, ...credentialHeaders(credentials)},
      body: target.body,
      signal: AbortSignal.timeout(target.timeout),
    });
  } catch (error) {
    return noResponse(error instanceof Error ? error.name : 'Network error');
  }

  let data: unknown = null;
  if (response.ok && response.status !== 204) {
    try {
      data = await response.json();
    } catch (error) {
      return noResponse('Invalid JSON');
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    data,
  };
};

/**
 * Make an API request for a content script, with the credentials only the
 * background holds, and answer with the status and the parsed data.
 *
 * Credentials go only to the endpoint they were stored for: while the stored
 * endpoint key names nothing, a request goes to the build default without
 * any (storedEndpoint.ts). A refused bearer token is refreshed once, for all
 * callers at once (getNewAccessToken), and the request retried once with the
 * new one.
 */
export const proxyApiRequest = async (
  message: ApiRequestMessage
): Promise<ApiResponse> => {
  const result = await getStorage().local.get(null);
  registerCustomEndpointFromStorage(result);
  const configured = isStoredEndpointConfigured(result);
  const urlKey = configured
    ? (result[StorageKeys.API_ENDPOINT_KEY] as string) || DefaultBaseUrlKey
    : undefined;

  if (message.kind === 'ignoreWord') {
    // The ignore list lives on the user's dashboard: nothing to send it to
    // in API-key mode, nor with credentials meant for another endpoint.
    if (!configured || !isDashboardAvailable(result)) {
      return noResponse('No dashboard');
    }
  }

  const target = targetFor(message, urlKey);
  if (!configured) return send(target, {});

  const apiKey = X_KEY || apiKeyFromStorage(result);
  if (apiKey) return send(target, {apiKey});

  const {accessToken} = await readTokens();
  const response = await send(target, {token: accessToken});
  if (!accessToken || !isTokenRefused(response.status)) {
    if (response.ok) refusedAfterRefresh = null;
    return response;
  }
  // Refused straight after a refresh already: refreshing again would not
  // help (an account the API does not let in) and would loop.
  if (accessToken === refusedAfterRefresh) return response;

  if ((await getNewAccessToken(accessToken)) !== 'refreshed') return response;
  const {accessToken: refreshed} = await readTokens();
  if (!refreshed || refreshed === accessToken) return response;
  const retried = await send(target, {token: refreshed});
  refusedAfterRefresh = isTokenRefused(retried.status) ? refreshed : null;
  return retried;
};

/**
 * A token a refresh produced that the API refused all the same. No refresh is
 * started for it until a request succeeds again.
 */
let refusedAfterRefresh: string | null = null;
