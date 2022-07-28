import { browser } from 'webextension-polyfill-ts';

export const wittyVersion = browser.runtime.getManifest().version;

//Development
export const DEV_ENV = true;

export const POSTHOG_API_KEY = DEV_ENV
  ? 'phc_o3cjCKKkO7rn3CTBUJNmehFoa6vPc3zYavfnGj7WyqK'
  : 'phc_tmJbApENFHLXMjwG1hHMYO4Md8qR4XAGRforELIiDwp';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  APP_ID = 'id',
  DISABLED_SITES = 'disabledSites',
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
  ENABLE_WITTY_EVERYWHERE = 'enableWittyEverywhere',
  TEAM_NAME = 'teamName',
  PLAN = 'plan',
}

//nlp api, dashboard
export type BaseUrl = {
  api: string;
  dashboard: string;
};

interface IBaseUrls {
  [key: string]: BaseUrl;
}

export const BaseUrls: IBaseUrls = {
  Prod: {
    api: 'https://default.api.witty.works/',
    dashboard: 'https://dashboard.witty.works/',
  },
  Dev: {
    api: 'https://dev-54ta5gq-nfkxhzxe3xgbw.de-2.platformsh.site/',
    dashboard: 'https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/',
  },
  Local: {
    api: 'http://127.0.0.1:8000/',
    dashboard: 'https://dashboard.lndo.site/',
  },
};

export const DefaultBaseUrlKey: keyof typeof BaseUrls =
  'Prod' as keyof typeof BaseUrls;

export enum ConfigPropertyStatus {
  FORCE = 'force',
  SUGGESTION = 'suggestion',
}

//HTML element's tags
export enum WTags {
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
  default: '#BCD485',
  highlight: '#D3E4AC',
  hover: '#BCD485',
};

const styleYellow: IHighlightColors = {
  default: '#F6EC6B',
  highlight: '#FFFFD3',
  hover: '#F6EC6B',
};

const unconsciousBiasAndGenderedOrange: IHighlightColors = {
  default: '#EB9F46',
  highlight: '#F8E7CB',
  hover: '#EB9F46',
};

const openlyDiscriminatingAndGrammarRed: IHighlightColors = {
  default: '#E6635A',
  highlight: '#F7D4D4',
  hover: '#E6635A',
};

export const getColor = (gravity: number): IHighlightColors => {
  if (!gravity) return inclusiveGreen;
  if (gravity < 1.5) return openlyDiscriminatingAndGrammarRed;
  if (gravity > 2.5) return styleYellow;
  return unconsciousBiasAndGenderedOrange;
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
