//API REQUEST/RESPONSE
import {TxtSentenceNode} from 'sentence-splitter';

export interface IRequest {
  url: string;
  config: RequestInit | null;
}

export interface ICheckRequest {
  text: string;
  repeatedRequest: boolean;
}

export interface IGetLLMSuggestionsRequest {
  alert: IAlert;
}

export interface DiffChange {
  added: boolean;
  removed: boolean;
  value: string;
}

export interface IEndpointError {
  status: number;
  message: string;
  request?: IRequest;
  responseSchema?: any;
}

export interface ResponseConfig {
  orthography: ConfigProperty;
  categories?: any;
  llm_alternatives?: ConfigProperty;
}
/** One togglable category from `GET /v2.0/categories`. */
export interface ICategory {
  key: string;
  label?: string | null;
  /** Diversity dimension this driver belongs to; matches ICategoryGroup.key. */
  parent: string;
  /**
   * The key that disables only the advanced rules, or null when the category
   * has no advanced tier. Supplied by the API rather than derived, so the
   * suffix convention stays server-side.
   */
  advanced_key?: string | null;
  proficiency_level?: string | null;
}

export interface ICategoryGroup {
  key: string;
  label?: string | null;
}

export interface ICategoriesResponse {
  categories: ICategory[];
  groups: ICategoryGroup[];
}

/** One enum-typed config field from `GET /v2.0/config-options`. */
export interface IConfigOption {
  values: string[];
  default?: string | null;
  /**
   * Optional value → display label map.
   *
   * The category endpoint already carries labels sourced from the dashboard's
   * JSON. When the same is done for these fields the extension picks them up
   * automatically; until then it falls back to its own strings, which are a
   * copy of the dashboard's wording and will drift.
   */
  labels?: Record<string, string>;
}

export interface IConfigOptionsResponse {
  options: Record<string, IConfigOption>;
}

export interface RequestConfig {
  addons: string[];
  /**
   * Categories the user switched off locally.
   *
   * The API seeds its own `disabled_categories` from this and then layers
   * organisation force-rules on top, so a client choice is honoured unless the
   * deployment explicitly overrides it. See `apply_configs` in the NLP API.
   */
  disabled_categories?: string[];
  /**
   * Gender ending and role-format preferences, as offered by
   * `GET /v2.0/config-options`. Sent only when the user has chosen one, so the
   * API's own default applies otherwise.
   */
  german_gender_ending?: string;
  french_gender_separator?: string;
  gendered_roles_format?: string;
}
export interface ConfigProperty {
  value: string | string[] | boolean | number;
  status?: string;
}

export interface ILLMAlternativesResponse {
  sentence: string;
  results: Map<string, string>;
}

//CHECK ENDPOINT
export interface ICheckResponse {
  results: ICheckResponseResult[];
  language: string;
  limit_reached: boolean;
  config_changed: boolean;
  notifications: number;
  gender_separator: string;
}

export interface ICheckResponseResult {
  text: string;
  text_id: string;
  context: string;
  category: string;
  subcategory: string;
  start: number;
  end: number;
  alternatives: IAlternatives[];
  explanation: IExplanation;
  label: string;
  gravity: number;
  language: string;
  limit_reached: boolean;
  source: ISource;
}

//AUTH/REFRESHTOKEN ENDPOINT
export interface IAuthResponse {
  config: ResponseConfig;
  organization_config: ResponseConfig;
  min_version: string;

  //private account
  id: string;
  name: string;
  domains: IDomains;
  config_hash: string;

  //organization account
  organization_id?: string;
  organization_name?: string;
  organization_domains: IDomains;
  organization_config_hash: string;
}

export interface IDomains {
  list: string[];
  type: string;
}
export interface IRefreshTokenResponse {
  email: string;
  refresh_token: string;
  access_token: string;
}

//HIGHLIGHTS
export interface Position {
  top: number;
  left: number;
}
export interface Highlight {
  rects: DOMRect[];
  id: string;
  data: IAlertContentData;
  startOffset: number;
  endOffset: number;
  node: Node;
}

export type CustomInputElement =
  HTMLTextAreaElement | HTMLInputElement | HTMLDivElement;

//ALERTS
export interface INodeWithAlerts {
  node: any;
  alerts: IAlert[];
  nodeIndex?: number;
}

export interface INodes {
  node: any;
  index: number;
  rawNode: Node;
}
export interface IAlert {
  id: string;
  startOffset: number;
  absOffset: number;
  endOffset: number;
  popOverIsOpen: boolean;
  data: IAlertContentData;
  organizationId?: string;
  userId?: string;
  rect?: any;
}
export interface IAlertContentData {
  text: string;
  text_id: string;
  context: string;
  fullSentence: TxtSentenceNode;
  category: string;
  subcategory: string;
  alternatives: IAlternatives[];
  label: string;
  explanation: IExplanation;
  language: string;
  gender_separator: string;
  gravity: number;
  limit_reached: boolean;
  source: ISource;
}

//POPOVER
export interface IAlternatives {
  text: string;
  remove: boolean;
  inspiration: boolean;
  context: string;
  collective_noun?: ConstrainBooleanParameters;
  male_form?: string;
  female_form?: string;
  url: string;
}

export interface IImage {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface IExplanation {
  text: string;
  long_text?: string;
  icon: string;
  icon_image: string;
  url: string;
  video_url?: string;
  image_url?: IImage;
  context: string;
  content: string;
}

export interface ISource {
  text: string;
  url: string;
}

//ANALYTICS
export interface ILogItems {
  request__type: string;
  request__lang: string;
  request__client: string;
  response__id: string;
  response__startOffset: number;
  response__endOffset: number;
  response__popOverIsOpen: boolean;
  response__data__language: string;
  response__data__category: string;
  response__data__subcategory: string;
  response__data__context: string;
  response__data__text: string;
  response__data__text__matched: string;

  response__data__label: string;
  response__data__explanation__text: string;
  response__data__explanation__icon: string;
  response__data__explanation__icon_image: string;
  response__data__explanation__url: string;
  response__data__alternatives: IAlternatives[];
  response__data__gravity: number;
}

export interface IFeatureFlagItems {
  request__type: string;
  flag__name: string;
  flag__accepted: boolean;
}

export interface IAlternativeLogItems extends ILogItems {
  request__alternative: string;
}
export interface IIgnoreLogItems extends ILogItems {}
export interface IVoteLogRequest {
  request__type: string;
  request__lang: string;
  request__client: string;
  vote__url: string;
}

export interface IDashboardLogRequest {
  request__type: string;
  request__lang: string;
  request__client: string;
  button__location: string;
}
export interface ICheckLogItems {
  request__id: string;
  request__type: string;
  request__lang: string;
  request__client: string;
  request__text__length: number;
  response__organizationId?: string;
  response__results: ICheckResponseResult[];
  response__data__language: string;
  response__limit_reached: boolean;
  request__hr__feature__disabled: boolean;
}

export interface ICheckResultLogItems {
  request__id: string;
  request__type: string;
  request__lang: string;
  request__client: string;
  request__text__length: number;
  response__organizationId?: string;
  response__data__text: string;
  response__data__text__matched: string;
  response__data__category: string;
  response__data__subcategory: string;
  response__startOffset: number;
  response__endOffset: number;
  response__data__alternatives: IAlternatives[];
  response__data__label: string;
  response__data__explanation__text: string;
  response__data__explanation__icon: string;
  response__data__explanation__icon_image: string;
  response__data__explanation__url: string;
  response__data__gravity: number;
  response__data__language: string;
  response__limit_reached: boolean;
  request__hr__feature__disabled: boolean;
}

export type DefaultConfigValue =
  string | boolean | number | string[] | object | (() => string);

export interface IDomainRequest {
  domain: string;
  enabled: boolean;
}

export interface EnableWittyToggle {
  enabled: boolean;
  updateDashboard: boolean;
}

export interface FeatureFlag {
  notificationHeadline_en: string;
  notificationHeadline_de: string;
  notificationText_en: string;
  notificationText_de: string;
  notificationButton_en: string;
  notificationButton_de: string;
}

export interface FeatureFlags {
  teamInviteFlag: FeatureFlag | null;
  friendInviteFlag: FeatureFlag | null;
}
