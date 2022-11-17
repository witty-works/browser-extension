//API REQUEST/RESPONSE
export interface IRequest {
  url: string;
  config: RequestInit | null;
}
export interface IEndpointError {
  status: number;
  message: string;
}

export interface ResponseConfig {
  gendered_roles_format: ConfigProperty;
  german_gender_ending: ConfigProperty;
  inclusive: ConfigProperty;
  maximum_importance: number;
  orthography: ConfigProperty;
  show_inspiration_alternatives: ConfigProperty;
  singular_they: ConfigProperty;
  style: ConfigProperty;
  preferred_variants: ConfigProperty;
}
export interface RequestConfig extends ResponseConfig {
  disabled_categories: string[];
}

export interface FilteredRequestConfig {
  style: ConfigProperty;
  orthography: ConfigProperty;
  inclusive: ConfigProperty;
  disabled_categories: string[];
}
export interface ConfigProperty {
  value: string | string[] | boolean | number;
  status?: string;
}

//CHECK ENDPOINT
export interface ICheckResponse {
  results: ICheckResponseResult[];
  language: string;
  limit_reached: boolean;
  config_changed: boolean;
  notifications: number;
}

export interface ICheckResponseResult {
  text: string;
  context: string;
  category: string;
  subcategory: string;
  start: number;
  end: number;
  alternatives: IAlternatives[];
  explanation: IExplanation;
  label: string;
  gravity: number;
}

//AUTH/REFRESHTOKEN ENDPOINT
export interface IAuthResponse {
  config: ResponseConfig;
  organization_config: ResponseConfig;
  plan: string;

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
  plan?: string;
}

export type CustomInputElement =
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLDivElement;

//ALERTS
export interface INodeWithAlerts {
  node: Node;
  alerts: IAlert[];
}
export interface IAlert {
  id: string;
  startOffset: number;
  endOffset: number;
  popOverIsOpen: boolean;
  data: IAlertContentData;
  organizationId?: string;
  plan?: string;
}
export interface IAlertContentData {
  text: string;
  context: string;
  category: string;
  subcategory: string;
  alternatives: IAlternatives[];
  label: string;
  explanation: IExplanation;
  language: string;
  gravity: number;
}

//POPOVER
export interface IAlternatives {
  text: string;
  remove: boolean;
  inspiration: boolean;
  context: string;
}

export interface IExplanation {
  text: string;
  icon: string;
  url: string;
  context: string;
}

//ANALYTICS
export interface ILogItems {
  request__type: string;
  request__lang: string;
  request__id: string;
  request__client: string;
  request__config__preferred_variants: ConfigProperty;
  request__config__german_gender_ending: ConfigProperty;
  response__id: string;
  response__startOffset: number;
  response__endOffset: number;
  response__popOverIsOpen: boolean;
  response__organizationId?: string;
  response__plan?: string;
  response__data__language: string;
  response__data__category: string;
  response__data__subcategory: string;
  response__data__context: string;
  response__data_text: string;
  response__data__label: string;
  response__data__explanation__text: string;
  response__data__explanation__icon: string;
  response__data__explanation__url: string;
  response__data__alternatives: IAlternatives[];
  response__data__gravity: number;
}
export interface IAlternativeLogItems extends ILogItems {
  request__alternative: string;
}
export interface IIgnoreLogItems extends ILogItems {}
export interface IVoteLogRequest {
  request__type: string;
  request__lang: string;
  request__id: string;
  request__client: string;
  request__config__preferred_variants: ConfigProperty;
  request__config__german_gender_ending: ConfigProperty;
  vote__url: string;
}

export interface IDashboardLogRequest {
  request__type: string;
  request__lang: string;
  request__id: string;
  request__client: string;
  request__config__preferred_variants: ConfigProperty;
  request__config__german_gender_ending: ConfigProperty;
  dashboard__location: string;
}
export interface ICheckLogItems {
  request__type: string;
  request__lang: string;
  request__id: string;
  request__client: string;
  request__config__preferred_variants: ConfigProperty;
  request__config__german_gender_ending: ConfigProperty;
  request__text__length: number;
  response__organizationId?: string;
  response__plan?: string;
  response__name?: string;
  response__results: ICheckResponseResult[];
  response__language: string;
  response__limit_reached: boolean;
}

export type DefaultConfigValue =
  | string
  | boolean
  | number
  | string[]
  | object
  | (() => string);

export interface IDomainRequest {
  domain: string;
  enabled: boolean;
}

export interface EnableWittyToggle {
  enabled: boolean;
  updateDashboard: boolean;
}

export interface IgnoredCategory {
  category: string;
  timestamp: number;
}
