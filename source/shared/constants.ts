import browser from 'webextension-polyfill';
import defaultConfig from '../witty.config.json';

export const wittyVersion = browser.runtime.getManifest().version;

//Development
// Driven by the build (`NODE_ENV=production` for `npm run build:*`), never
// hardcoded. When this was pinned to `true` every release build shipped dev
// behaviour: the ApiSelector visible in the popup, the dev-tier
// `exposeWittyIdAllowList`, and `setInLocalStorage` unconditionally overwriting
// stored values.
export const DEV_ENV = process.env.NODE_ENV !== 'production';

//Testing
// Build-driven like DEV_ENV. The Playwright suite builds with TESTING=true so
// the on-install OAuth flow does not fire: `identity.launchWebAuthFlow` would
// open an auth window that never resolves without a real dashboard, leaving a
// stray window in front of every screenshot.
export const TESTING = process.env.TESTING === 'true';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  API_DELAY = 'apiDelay',
  APP_ID = 'id',

  ORTHOGRAPHY = 'spellChecking',

  ACCESS_TOKEN = 'accessToken',
  REFRESH_TOKEN = 'refreshToken',
  ACCESS_TOKEN_EXPIRES_AT = 'accessTokenExpiresAt',
  /** User-configured endpoint, set only from the options page. */
  CUSTOM_ENDPOINT = 'customEndpoint',
  /** 'account' (OAuth via a dashboard) or 'apiKey'. Set from the options page. */
  AUTH_MODE = 'authMode',
  /**
   * `{ endpoint, value }` — the API key together with the endpoint key it was
   * entered for. Binding the two means a key can never be presented to a
   * different deployment; see `apiKeyFromStorage`.
   */
  API_KEY = 'apiKey',
  /**
   * Category list as reported by the server, used to render the options page
   * toggles. Populated from `/v2.0/auth`; the section stays hidden while empty,
   * so a deployment that does not report categories simply does not offer them.
   */
  CATEGORIES = 'categories',
  /** Category keys the user switched off; sent as `config.disabled_categories`. */
  DISABLED_CATEGORIES = 'disabledCategories',
  /**
   * Non-secret marker in `storage.local` mirroring whether an access token
   * exists. The token itself lives in `storage.session` — see tokenStore.ts.
   */
  SIGNED_IN = 'signedIn',
  TEAM_NAME = 'teamName',

  DOMAINS = 'domains',
  ORGANIZATION_DOMAINS = 'organizationDomains',
  CONFIG_HASH = 'configHash',
  ORGANIZATION_CONFIG_HASH = 'organizationConfigHash',

  LLM_ALTERNATIVES = 'llmAlternatives',

  CHECK_ENDPOINT_SUCCESS = 'checkEndpointSuccess',

  NUMBER_OF_NOTIFICATIONS = 'numberOfNotifications',


  USER_ID = 'userId',
  ORGANIZATION_ID = 'organizationId',

  ID_WAS_ALIASED = 'idWasAliased',
  PIN_NOTIFICATION_SHOWED = 'pinNotificationShowed',
  NUMBER_OF_ALTERNATIVES_ACCEPTED = 'numberOfAlternativesAccepted',

  INVITE_TEAM_FEATURE_FLAG = 'invite-team-feature-flag',
  INVITE_FRIENDS_FEATURE_FLAG = 'invite-friends-feature-flag',

  EXTENSION_WAS_UPDATED = 'extensionWasUpdated',
  TOTAL_MAX_CHAR_LENGTH_NOTIFICATION_SHOWED = 'totalMaxCharLengthNotificationShowed',

  IFRAME_DOMAINS = 'iframeDomains',
  DAILY_POSTHOG_EVENTS_USED = 'dailyPosthogEventsUsed',
  LAST_CHECK_EVENT_TIME = 'lastCheckEventTime',
  HR_FEATURES_DISABLED_DOMAINS = 'hrFeaturesDisabledDomains',
}

/**
 * Static credentials that can be baked into `witty.config.json`.
 *
 * These exist purely as a local-development and CI convenience. `X_KEY` in
 * particular is a *shared* API key: anything it is compiled into can be
 * unpacked by whoever installs it, so it must never reach a build a real user
 * runs. Release builds force both to empty, which lets the bundler
 * dead-code-eliminate every branch that depends on them; `webpack.config.js`
 * additionally fails the build outright if any of REFRESH_TOKEN, ACCESS_TOKEN or
 * X_KEY is set while
 * `NODE_ENV=production`, so a mistake here is caught before it ships rather
 * than being silently neutered.
 */
export const X_KEY = DEV_ENV ? defaultConfig.X_KEY || '' : '';
export const STATIC_ACCESS_TOKEN = DEV_ENV
  ? defaultConfig.ACCESS_TOKEN || ''
  : '';

//nlp api, dashboard
export type BaseUrl = {
  api: string;
  dashboard: string;
  posthog_url: string;
  posthog_key: string;
  /**
   * OAuth client ID for this deployment's dashboard. Public by design — a PKCE
   * public client has no secret, because an extension bundle cannot keep one.
   * Self-hosters register the extension's redirect URI
   * (`identity.getRedirectURL()`) on their own dashboard and put the resulting
   * client ID here.
   */
  oauth_client_id: string;
};

interface IBaseUrls {
  [key: string]: BaseUrl;
}

// Cloned rather than aliased, so registering a custom endpoint below does not
// mutate the imported JSON module.
export const BaseUrls: IBaseUrls = {
  ...(defaultConfig.BASE_URLS as unknown as IBaseUrls),
};

/** The endpoints compiled into this build, before any user-added one. */
export const CompiledBaseUrlKeys = Object.keys(BaseUrls);

/** Key under which a user-configured endpoint is registered at runtime. */
export const CUSTOM_BASE_URL_KEY = 'Custom';

export const isAllowedBaseUrlKey = (key: string | undefined): boolean =>
  !!key && Object.prototype.hasOwnProperty.call(BaseUrls, key);

// Release builds must not default to a developer's localhost API. Fall back to
// whatever the config does define so a self-hosted build with a single compiled
// entry still works. Deliberately computed from the *compiled* set: a custom
// endpoint must never become the default just by existing.
const preferredBaseUrlKey = DEV_ENV ? 'Local' : 'Prod';

export const DefaultBaseUrlKey = CompiledBaseUrlKeys.includes(
  preferredBaseUrlKey
)
  ? preferredBaseUrlKey
  : CompiledBaseUrlKeys[0];

/**
 * Add or remove the user-configured endpoint.
 *
 * Registering it into `BaseUrls` means every existing consumer — the
 * `ApiSelector` dropdown, `isAllowedBaseUrlKey`, `setBaseUrls` — keeps working
 * unchanged, and the compile-time allow-list still rejects anything that was
 * neither compiled in nor deliberately added here.
 *
 * This is the *only* way an endpoint enters the set at runtime, and it is
 * reached solely from the options page. Nothing driven by a web page, a URL
 * parameter or a message can call it — see section 4 of AUTH_SECURITY_PLAN.md.
 */
export const registerCustomEndpoint = (endpoint: BaseUrl | null): void => {
  if (endpoint?.api) {
    BaseUrls[CUSTOM_BASE_URL_KEY] = endpoint;
  } else {
    delete BaseUrls[CUSTOM_BASE_URL_KEY];
  }
};

/**
 * Register the custom endpoint from a `storage.local` snapshot.
 *
 * Each bundle (background, popup, content script, options) is its own JS
 * context with its own copy of `BaseUrls`, so each has to register the endpoint
 * for itself. Call this with the same snapshot that decides which key to pass to
 * `setBaseUrls`, so the key is never resolved before the entry it names exists.
 */
export const registerCustomEndpointFromStorage = (
  result: Record<string, any>
): void => {
  registerCustomEndpoint((result?.[StorageKeys.CUSTOM_ENDPOINT] as BaseUrl) ?? null);
};

/**
 * A custom endpoint must be https, with loopback exempted so a self-hoster can
 * point at a local dashboard while developing. Anything else would let the
 * bearer token travel in plaintext.
 */
export const isAcceptableEndpointUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;

    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch (error) {
    return false;
  }
};

export type AuthMode = 'account' | 'apiKey';

export interface StoredApiKey {
  endpoint: string;
  value: string;
}

export const getAuthMode = (result: Record<string, any>): AuthMode =>
  result?.[StorageKeys.AUTH_MODE] === 'apiKey' ? 'apiKey' : 'account';

/**
 * The API key for the endpoint currently in use, or '' if there isn't one.
 *
 * Two guards, both structural rather than something we have to remember to do:
 *
 * 1. **Mode.** API-key and account sign-in are mutually exclusive, so a key is
 *    only ever returned in API-key mode. This is what stops a leftover key from
 *    silently taking precedence over an account token — `buildRequestHeaders`
 *    short-circuits on `x-key`, so without this check a stale key would
 *    override the signed-in user rather than the other way round.
 * 2. **Endpoint.** The key is stored together with the endpoint it belongs to
 *    and only returned when the two still agree, so switching endpoints cannot
 *    carry a key from one deployment to another.
 */
export const apiKeyFromStorage = (result: Record<string, any>): string => {
  if (getAuthMode(result) !== 'apiKey') {
    return '';
  }

  const record = result?.[StorageKeys.API_KEY] as StoredApiKey | undefined;
  if (!record?.value) {
    return '';
  }

  const current =
    (result?.[StorageKeys.API_ENDPOINT_KEY] as string) || DefaultBaseUrlKey;

  return record.endpoint === current ? record.value : '';
};

/**
 * Whether a dashboard is reachable in the current mode.
 *
 * API-key mode is for deployments that run only the NLP API, so every
 * dashboard-backed feature — domain sync, ignore-permanently, the settings and
 * editor links — has to be hidden rather than left to fail at runtime.
 */
export const isDashboardAvailable = (result: Record<string, any>): boolean =>
  getAuthMode(result) !== 'apiKey';

/**
 * Help centre links.
 *
 * Centralised so a moved or renamed article is a one-line fix rather than a
 * hunt through components. Slugs must match the registry in the website repo
 * (`_includes/help-articles.php`); the extension previously pointed at three
 * pages that no longer existed.
 */
const HELP_BASE = 'https://www.witty.works/en/help/';

export const HelpLinks = {
  helpCentre: 'https://www.witty.works/help',
  ownServer: `${HELP_BASE}how-do-i-connect-witty-to-my-own-server`,
  withoutDashboard: `${HELP_BASE}can-i-use-witty-without-the-dashboard`,
  notWorking: `${HELP_BASE}witty-doesnt-work`,
  updateWitty: `${HELP_BASE}how-can-i-update-witty`,
  customise: `${HELP_BASE}how-do-i-customize-witty`,
};

export enum ConfigPropertyStatus {
  FORCE = 'force',
  SUGGESTION = 'suggestion',
}

//HTML element's tags
export enum WTags {
  WW_SHADOW_ROOT_CONTAINER = 'ww-shadow-root-container',
  WW_CONTAINER = 'ww-container',
  WW_HIGHLIGHTS = 'ww-highlights',
  WW_MOUSEOVER_INDICATOR = 'ww-mo-indicator',
  WW_ACTIVITY_INDICATOR = 'ww-activity-indicator',
  WW_CLONE = 'ww-clone',
  WW_POPOVER = 'ww-popover',
}

//Colors
export enum Colors {
  red = '#F06464',
  magenta = '#F277D0',
  purple = '#9489DB',
  blue = '#55B8E9',
  cyan = '#37D1E5',
  green = '#5fca7d',
}
interface IHighlightColors {
  default: string;
  highlight: string;
  hover: string;
}

const inclusiveGreen: IHighlightColors = {
  hover: '#BCD485',
  default: '#D3E4AC',
  highlight: '#BCD485',
};

const corporateBlue: IHighlightColors = {
  hover: '#6f9FED',
  default: '#A1BEED',
  highlight: '#6f9FED',
};

const styleYellow: IHighlightColors = {
  hover: '#F6EC6B',
  default: '#FFFFD3',
  highlight: '#F6EC6B',
};

const unconsciousBiasAndGenderedOrange: IHighlightColors = {
  hover: '#EB9F46',
  default: '#F8E7CB',
  highlight: '#EB9F46',
};

const openlyDiscriminatingAndGrammarRed: IHighlightColors = {
  hover: '#E6635A',
  default: '#F7D4D4',
  highlight: '#E6635A',
};

export const getColor = (
  gravity: number,
  subcategory: string
): IHighlightColors => {
  if (subcategory === 'corporate_rules') return corporateBlue;
  if (!gravity) return inclusiveGreen;
  else if (gravity < 1.5) return openlyDiscriminatingAndGrammarRed;
  else if (gravity > 2.5) return styleYellow;
  else return unconsciousBiasAndGenderedOrange;
};

//German Gender Endings
export enum GermanGenderEndings {
  asterisk_in = '*in',
  colon_in = ':in',
  underscore_in = '_in',
  slash_dash_in = '/-in',
  slash_in = '/in',
  uppercase_in = 'In',
}

//Icons
export const WittyIconActive = {
  path: {
    '16': '/assets/icons/icon16.png',
    '32': '/assets/icons/icon32.png',
    '48': '/assets/icons/icon48.png',
  },
};

export const dropdownOptions = [
  {
    key: 0,
    value: '0 seconds',
  },
  {
    key: 500,
    value: '0.5 seconds',
  },
  {
    key: 1000,
    value: '1 second',
  },
  {
    key: 1500,
    value: '1.5 seconds',
  },
  {
    key: 2000,
    value: '2 seconds',
  },
  {
    key: 2500,
    value: '2.5 seconds',
  },
  {
    key: 3000,
    value: '3 seconds',
  },
];

export const exposeWittyIdAllowList = DEV_ENV
  ? defaultConfig.EXPOSE_WITTY_ID_ALLOW_LIST?.dev
  : defaultConfig.EXPOSE_WITTY_ID_ALLOW_LIST?.prod;
