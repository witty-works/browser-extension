import { IAlert, IRequest, RequestConfig } from '../types';
import { BaseUrls, wittyVersion } from '../constants';
import { TxtSentenceNode } from 'sentence-splitter';

let BASE_URL_API: string = '';
let BASE_URL_DASHBOARD: string = '';
let BASE_URL_POSTHOG: string = '';
let BASE_KEY_POSTHOG: string = '';
let token: string = '';
let configHash: string = '';
let organizationConfigHash: string = '';

export let appID: string = ''; // TODO context hook

export let requestConfig: RequestConfig = {} as RequestConfig;

export const createUrl = (base: string, path: string): string =>
  `${base}${path}`;

export const setBaseUrls = (urlKey: string) => {
  BASE_URL_API = BaseUrls[urlKey].api;
  BASE_URL_DASHBOARD = BaseUrls[urlKey].dashboard;
  BASE_URL_POSTHOG = BaseUrls[urlKey].posthog_url;
  BASE_KEY_POSTHOG = BaseUrls[urlKey].posthog_key;
};

export const getBaseUrls = () => {
  return {
    api: BASE_URL_API,
    dashboard: BASE_URL_DASHBOARD,
    posthog_url: BASE_URL_POSTHOG,
    posthog_key: BASE_KEY_POSTHOG
  };
};

export const setRequestConfig = (reqConfig: RequestConfig) => {
  requestConfig = reqConfig;
};

export const setAppID = (id: string) => (appID = id);

export const setToken = (tok: string) => (token = tok);

export const getAnalyzedTextResults = (text: string): IRequest => {
  return {
    url: createUrl(BASE_URL_API, 'v2.4/check'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
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

export const getLLMSuggestion = (sentence: TxtSentenceNode, alert: IAlert): IRequest => {
  return {
    url: createUrl(BASE_URL_API, 'v1.0/rephrase'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: sentence
        ? JSON.stringify({
          sentence: sentence.raw,
          text: alert.data.text,
          start: alert.absOffset - sentence.range[0],
          gender_separator: alert.data.gender_separator,
          alternatives: alert.data.alternatives.filter(alt => !alt.remove),
          lang: alert.data.language || "en"
        })
        : null,
      signal: AbortSignal.timeout(3000)
    },
  };
};

export const getConfiguration = (): IRequest => {
  return {
    url: BASE_URL_API && createUrl(BASE_URL_API, 'v2.0/auth'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  };
};

export const getToken = (refreshToken: string): IRequest => {
  return {
    url: createUrl(BASE_URL_DASHBOARD, 'api/refresh-token'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: refreshToken
        ? JSON.stringify({
            token: refreshToken,
          })
        : null,
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
