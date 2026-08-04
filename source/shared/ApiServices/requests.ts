import { IAlert, IRequest, RequestConfig } from '../types';
import {
  BaseUrls,
  DefaultBaseUrlKey,
  isAllowedBaseUrlKey,
  wittyVersion,
  X_KEY,
} from '../constants';
import { TxtSentenceNode } from 'sentence-splitter';

let BASE_URL_API: string = '';
let BASE_URL_DASHBOARD: string = '';
let BASE_URL_POSTHOG: string = '';
let BASE_KEY_POSTHOG: string = '';
let token: string = '';
let apiKey: string = '';
let configHash: string = '';
let organizationConfigHash: string = '';

export let appID: string = ''; // TODO context hook

export let requestConfig: RequestConfig = {} as RequestConfig;

export const createUrl = (base: string, path: string): string =>
  `${base}${path}`;

export const setBaseUrls = (urlKey: string) => {
  // Only endpoints compiled into this build are reachable. A key read back from
  // extension storage is untrusted input: it may be stale (a 'Local' left behind
  // by a dev build, which would silently keep a release build pointed at
  // localhost) or absent from a self-hosted config. Fall back to the build's
  // default rather than throwing on `BaseUrls[urlKey].api`.
  const key = isAllowedBaseUrlKey(urlKey) ? urlKey : DefaultBaseUrlKey;

  BASE_URL_API = BaseUrls[key].api;
  BASE_URL_DASHBOARD = BaseUrls[key].dashboard;
  BASE_URL_POSTHOG = BaseUrls[key].posthog_url;
  BASE_KEY_POSTHOG = BaseUrls[key].posthog_key;
};

export const getBaseUrls = () => {
  return {
    api: BASE_URL_API,
    dashboard: BASE_URL_DASHBOARD,
    posthog_url: BASE_URL_POSTHOG,
    posthog_key: BASE_KEY_POSTHOG,
  };
};

export const setRequestConfig = (reqConfig: RequestConfig) => {
  requestConfig = reqConfig;
};

export const setAppID = (id: string) => (appID = id);

export const setToken = (tok: string) => (token = tok);

/**
 * Runtime API key, entered by the user on the options page.
 *
 * Distinct from the build-time `X_KEY`: that one is a *shared* secret compiled
 * into a bundle everyone installs and can unpack, which is why release builds
 * refuse it. This one is the user's own credential, held in their own profile —
 * ordinary API-key handling.
 */
export const setApiKey = (key: string) => (apiKey = key);

export const buildRequestHeaders = (
  useToken?: string
): { [key: string]: string } => {
  const headers: { [key: string]: string } = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // Build-time key first (CI only), then the user's runtime key, then the
  // OAuth bearer token. An x-key and an Authorization header are never sent
  // together: the API would resolve two different identities from one request.
  if (X_KEY) {
    headers['x-key'] = X_KEY;
    return headers;
  }

  if (apiKey) {
    headers['x-key'] = apiKey;
    return headers;
  }

  if (useToken) {
    headers['Authorization'] = `Bearer ${useToken}`;
  }

  return headers;
};

export const getAnalyzedTextResults = (text: string): IRequest => {
  return {
    url: createUrl(BASE_URL_API, 'v2.4/check'),
    config: {
      method: 'POST',
      headers: buildRequestHeaders(token),
      body: text
        ? JSON.stringify({
            text: text,
            lang: 'auto',
            id: appID,
            client: wittyVersion,
            config: requestConfig,
            config_hash: configHash,
            organization_config_hash: organizationConfigHash,
          })
        : null,
    },
  };
};

export const getLLMSuggestion = (
  sentence: TxtSentenceNode,
  alert: IAlert
): IRequest => {
  return {
    url: createUrl(BASE_URL_API, 'v1.0/rephrase'),
    config: {
      method: 'POST',
      headers: buildRequestHeaders(token),
      body: sentence
        ? JSON.stringify({
            sentence: sentence.raw,
            text: alert.data.text,
            start: alert.absOffset - sentence.range[0],
            gender_separator: alert.data.gender_separator,
            alternatives: alert.data.alternatives.filter((alt) => !alt.remove),
            lang: alert.data.language || 'en',
          })
        : null,
      signal: AbortSignal.timeout(3000),
    },
  };
};

export const getConfiguration = (): IRequest => {
  return {
    url: BASE_URL_API && createUrl(BASE_URL_API, 'v2.0/auth'),
    config: {
      method: 'POST',
      headers: buildRequestHeaders(token),
    },
  };
};

// centralize login url creation when we figure out how to pass the data
// export const getLoginUrlDashboard = () => {
//   let url = '';
//   browser.storage.local
//   .get(null)
//   .then((result) => {
//     const urls =
//       result[StorageKeys.API_ENDPOINT_KEY]
//         ? result[StorageKeys.API_ENDPOINT_KEY]
//         : DefaultBaseUrlKey

//     const optionsPageUrl = browser.runtime.getURL('options.html');
//     const target = `${BaseUrls[urls].dashboard}editor?onboarding=true`;
//     url = `${BaseUrls[urls].dashboard}browser-login?redirect_uri=${optionsPageUrl}?target=${target}`;
//   })
//   return url;
// };
