import {IAlert, IAlternatives, IRequest, RequestConfig} from '../types';
import {
  BaseUrls,
  DefaultBaseUrlKey,
  isAllowedBaseUrlKey,
  wittyVersion,
  X_KEY,
} from '../constants';
import {TxtSentenceNode} from 'sentence-splitter';
import {apiLocale} from './apiLocale';

let BASE_URL_API = '';
let BASE_URL_DASHBOARD = '';
let BASE_URL_POSTHOG = '';
let BASE_KEY_POSTHOG = '';
let token = '';
let apiKey = '';
const configHash = '';
const organizationConfigHash = '';

export let appID = ''; // TODO context hook

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

/** NLP API paths, relative to the endpoint's base URL. */
export const CHECK_PATH = 'v2.4/check';
export const REPHRASE_PATH = 'v1.0/rephrase';
export const CONFIG_OPTIONS_PATH = 'v2.0/config-options';
/**
 * Category list with labels in `locale` (the UI's language; one the API does
 * not accept falls back, see apiLocale); unauthenticated and cacheable.
 */
export const categoriesPath = (locale: string): string =>
  `v2.0/categories?locale=${apiLocale(locale)}`;

export const JSON_HEADERS: Readonly<Record<string, string>> = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

/**
 * The one credential header a request carries: an API key as `x-key`, else a
 * bearer token. Never both — the API would resolve two different identities
 * from one request. Shared with the editor component.
 */
export const credentialHeaders = (credentials: {
  apiKey?: string;
  token?: string;
}): Record<string, string> => {
  if (credentials.apiKey) return {'x-key': credentials.apiKey};
  if (credentials.token) {
    return {Authorization: `Bearer ${credentials.token}`};
  }
  return {};
};

export const buildRequestHeaders = (
  useToken?: string
): {[key: string]: string} => {
  // Build-time key first (CI only), then the user's runtime key, then the
  // OAuth bearer token.
  return {
    ...JSON_HEADERS,
    ...credentialHeaders({apiKey: X_KEY || apiKey, token: useToken}),
  };
};

export interface CheckBodyFields {
  text: string;
  lang?: string;
  id: string;
  client: string;
  config?: object;
  configHash?: string;
  organizationConfigHash?: string;
}

/**
 * Body of a `/v2.4/check` request. Optional fields are left out when not
 * given, so the API's precedence rules (request over a stored "suggestion",
 * stored "force" over both) see only what the client actually chose. Shared
 * with the editor component.
 */
export const buildCheckBody = (
  fields: CheckBodyFields
): Record<string, unknown> => {
  const {text, lang = 'auto', id, client, config} = fields;
  return {
    text,
    lang,
    id,
    client,
    ...(config !== undefined ? {config} : {}),
    ...(fields.configHash !== undefined
      ? {config_hash: fields.configHash}
      : {}),
    ...(fields.organizationConfigHash !== undefined
      ? {organization_config_hash: fields.organizationConfigHash}
      : {}),
  };
};

export const getAnalyzedTextResults = (text: string): IRequest => {
  return {
    url: createUrl(BASE_URL_API, CHECK_PATH),
    config: {
      method: 'POST',
      headers: buildRequestHeaders(token),
      body: text
        ? JSON.stringify(
            buildCheckBody({
              text,
              id: appID,
              client: wittyVersion,
              config: requestConfig,
              configHash,
              organizationConfigHash,
            })
          )
        : null,
    },
  };
};

/**
 * Body of a `/v1.0/rephrase` request: the sentence around `alert`, to be
 * rewritten with each of its alternatives. Shared with the editor component,
 * which sends it with its own endpoint and credentials.
 */
export interface LLMSuggestionBody {
  sentence: string;
  text: string;
  start: number;
  gender_separator?: string;
  alternatives: IAlternatives[];
  lang: string;
}

export const buildLLMSuggestionBody = (
  sentence: TxtSentenceNode,
  alert: IAlert
): LLMSuggestionBody => {
  return {
    sentence: sentence.raw,
    text: alert.data.text,
    start: alert.absOffset - sentence.range[0],
    gender_separator: alert.data.gender_separator,
    alternatives: alert.data.alternatives.filter((alt) => !alt.remove),
    lang: alert.data.language || 'en',
  };
};

/** How long an LLM rewrite may take before the popover falls back. */
export const LLM_SUGGESTION_TIMEOUT_MS = 3000;

export const getLLMSuggestion = (
  sentence: TxtSentenceNode,
  alert: IAlert
): IRequest => {
  return {
    url: createUrl(BASE_URL_API, REPHRASE_PATH),
    config: {
      method: 'POST',
      headers: buildRequestHeaders(token),
      body: sentence
        ? JSON.stringify(buildLLMSuggestionBody(sentence, alert))
        : null,
      signal: AbortSignal.timeout(LLM_SUGGESTION_TIMEOUT_MS),
    },
  };
};

/**
 * The category list a client may put in `config.disabled_categories`.
 *
 * Unauthenticated and cacheable by design: the answer is identical for every
 * user. `/v2.0/auth` only reports categories the dashboard synced into an
 * organisation config, so this is the only source for a deployment running on
 * API keys alone.
 */
export const getCategories = (locale: string): IRequest => {
  return {
    url: BASE_URL_API && createUrl(BASE_URL_API, categoriesPath(locale)),
    config: {
      method: 'GET',
      headers: {Accept: 'application/json'},
    },
  };
};

/**
 * The values `config.german_gender_ending` and its siblings accept.
 *
 * Like the category list, unauthenticated and cacheable — and the only way a
 * deployment without a dashboard can learn what this API version understands.
 */
export const getConfigOptions = (): IRequest => {
  return {
    url: BASE_URL_API && createUrl(BASE_URL_API, CONFIG_OPTIONS_PATH),
    config: {
      method: 'GET',
      headers: {Accept: 'application/json'},
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
