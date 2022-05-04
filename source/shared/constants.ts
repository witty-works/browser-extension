import { browser } from 'webextension-polyfill-ts';

export const wittyVersion = browser.runtime.getManifest().version;

//Development
export const DEV_ENV = process.env.NODE_ENV === 'development';

export const POSTHOG_API_KEY = DEV_ENV
  ? 'phc_o3cjCKKkO7rn3CTBUJNmehFoa6vPc3zYavfnGj7WyqK'
  : 'phc_tmJbApENFHLXMjwG1hHMYO4Md8qR4XAGRforELIiDwp';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  APP_ID = 'id',
  DISABLED_SITES = 'disabledSites',
  PRIMARY_LANGUAGE = 'primaryLanguage',
  PREFERRED_LANGUAGES = 'preferredLanguages',
  PREFERRED_VARIANTS = 'preferredVariants',
  GERMAN_GENDER_ENDING = 'germanGenderEnding',
  ORTHOGRAPHY = 'spellChecking',
  STYLE = 'styleCorrections',
  INCLUSIVE = 'inclusiveLanguage',
  SHOW_INSPIRATION_ALTERNATIVES = 'inspirationalAlternatives',
  SINGULAR_THEY = 'singularThey',
  MAXIMUM_IMPORTANCE = 'maximumImportance',
  CASING_SITES = 'casingSites',
  API_DELAY = 'apiDelay',
  GENDERED_ROLES_FORMAT = 'genderedRolesFormat',
  USERNAME = 'username',
  ACCESS_TOKEN = 'accessToken',
  REFRESH_TOKEN = 'refreshToken',
  CURRENT_DOMAIN = 'currentDomain',
}

//API endpoints
export enum BaseUrls {
  API_PLATFORMSH = 'https://default.api.witty.works/',
  DEV_PLATFORMSH = 'https://dev-54ta5gq-nfkxhzxe3xgbw.de-2.platformsh.site/',
  // DEV_PLATFORMSH = 'https://default.api.witty.works.dev-54ta5gq-nfkxhzxe3xgbw.de-2.platformsh.site/',
  WITTY_LOCAL = 'http://127.0.0.1:8000/',
}

export const DefaultBaseUrlKey: keyof typeof BaseUrls = Object.keys(
  BaseUrls
)[0] as keyof typeof BaseUrls;

export enum ConfigPropertyStatus {
  FORCE = 'force',
  SUGGESTION = 'suggestion',
}

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
  default: '#BCD485',
  highlight: '#D3E4AC',
  hover: '#C9DF7F',
};

const styleYellow: IHighlightColors = {
  default: '#F6EC6B',
  highlight: '#FFFFD3',
  hover: '#FFF7A4',
};

const unconsciousBiasAndGenderedOrange: IHighlightColors = {
  default: '#EB9F46',
  highlight: '#F8E7CB',
  hover: '#F8D29F',
};

const openlyDiscriminatingAndGrammarRed: IHighlightColors = {
  default: '#E6635A',
  highlight: '#F7D4D4',
  hover: '#F8BEBB',
};

export const getColor = (gravity: number): IHighlightColors => {
  if (!gravity) return inclusiveGreen;
  if (gravity == 1) return openlyDiscriminatingAndGrammarRed;
  if (gravity == 2) return unconsciousBiasAndGenderedOrange;
  if (gravity == 3) return styleYellow;
  return unconsciousBiasAndGenderedOrange;
};

//German Gender Endings
export enum GermanGenderEndings {
  colon_in = ':in',
  asterisk_in = '*in',
  underscore_in = '_in',
  slash_dash_in = '/-in',
  slash_in = '/in',
  uppercase_in = 'In',
}

export const WittyIconActive = {
  path: {
    '16': 'assets/icons/icon16.png',
    '32': 'assets/icons/icon32.png',
    '48': 'assets/icons/icon48.png',
  },
};

export const WittyIconInactive = {
  path: {
    '16': 'assets/icons/icon16_disabled.png',
    '32': 'assets/icons/icon32_disabled.png',
    '48': 'assets/icons/icon48_disabled.png',
  },
};
