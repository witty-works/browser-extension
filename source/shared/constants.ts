import { browser } from 'webextension-polyfill-ts';
import { IExplanation } from './types';
export const wittyVersion = browser.runtime.getManifest().version;

//Development
export const DEV_ENV = true;

export const POSTHOG_API_KEY_EU = DEV_ENV
  ? 'phc_DUofw8HC9GUENhXmZ8Wan7DGAvmWFrFnNCxoViLmuhx'
  : 'phc_i1tlvuh1iecIOSEr0QmTEIklrsSJGhULpUwUlf8fkkl';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  API_DELAY = 'apiDelay',
  APP_ID = 'id',

  PREFERRED_VARIANTS = 'preferredVariants',
  GERMAN_GENDER_ENDING = 'germanGenderEnding',
  ORTHOGRAPHY = 'spellChecking',
  STYLE = 'styleCorrections',
  INCLUSIVE = 'inclusiveLanguage',
  SHOW_INSPIRATION_ALTERNATIVES = 'inspirationalAlternatives',
  SINGULAR_THEY = 'singularThey',
  MAXIMUM_IMPORTANCE = 'maximumImportance',
  CASING_SITES = 'casingSites',
  GENDERED_ROLES_FORMAT = 'genderedRolesFormat',

  ACCESS_TOKEN = 'accessToken',
  REFRESH_TOKEN = 'refreshToken',
  PLAN = 'plan',
  TEAM_NAME = 'teamName',

  DOMAINS = 'domains',
  ORGANIZATION_DOMAINS = 'organizationDomains',
  CONFIG_HASH = 'configHash',
  ORGANIZATION_CONFIG_HASH = 'organizationConfigHash',
  DOMAIN_TO_UPDATE = 'domainToUpdate',

  CHECK_ENDPOINT_SUCCESS = 'checkEndpointSuccess',

  DOMAINS_CONFIRMED_TO_WORK = 'domainsConfirmedToWork',
  DOMAINS_CONFIRMED_TO_NOT_WORK = 'domainsConfirmedNotToWork',
  NUMBER_OF_NOTIFICATIONS = 'numberOfNotifications',

  REDIRECT_URL_LOGIN = 'redirectUrlLogin',
  IGNORED_CATEGORIES = 'ignoredCategories',

  USER_ID = 'userId',
  ORGANIZATION_ID = 'organizationId',

  ID_WAS_ALIASED = 'idWasAliased',
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

export const DefaultBaseUrlKey: keyof typeof BaseUrls = DEV_ENV
  ? ('Dev' as keyof typeof BaseUrls)
  : ('Prod' as keyof typeof BaseUrls);

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

const disabledGrey: IHighlightColors = {
  default: '#BEBEBE',
  highlight: '#BEBEBE',
  hover: '#BEBEBE',
};

const openlyDiscriminatingAndGrammarRed: IHighlightColors = {
  default: '#E6635A',
  highlight: '#F7D4D4',
  hover: '#E6635A',
};

export const getColor = (
  gravity: number,
  userIsSignedIn: boolean,
  hasExplanation?: IExplanation,
  plan?: string
): IHighlightColors => {
  if (!userIsSignedIn) return disabledGrey;
  else if (!hasExplanation && plan === 'witty_free') return disabledGrey;
  else if (!gravity) return inclusiveGreen;
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
    '16': 'assets/icons/icon16.png',
    '32': 'assets/icons/icon32.png',
    '48': 'assets/icons/icon48.png',
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
  ? ['lndo.site', 'platformsh.site', 'witty.works']
  : ['witty.works'];
