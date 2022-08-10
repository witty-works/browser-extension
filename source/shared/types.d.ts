export interface RequestConfig {
  store_context: ConfigProperty;
  preferred_variants: ConfigProperty;
  german_gender_ending: ConfigProperty;
  gendered_roles_format: ConfigProperty;
  inclusive: ConfigProperty;
  style: ConfigProperty;
  orthography: ConfigProperty;
  singular_they: ConfigProperty;
  show_inspiration_alternatives: ConfigProperty;
  maximum_importance: ConfigProperty;
}

export interface ConfigProperty {
  value: string | string[] | boolean | number;
  status?: string;
}
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
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLDivElement;

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
  groupId?: string | null;
  plan: string | null;
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

export interface ICheckResponse {
  results: ICheckResponseResult[];
  organization_config: RequestConfig;
  language: string;
  limit_reached: boolean;
  config_changed: boolean;
  domains: object;
  organization_domains: object;
}
export interface IAuthResponse {
  config: RequestConfig;
  id: string;
  name: string;
  plan: string;
  domains: object;
  organization_domains: object;
}
export interface IRefreshTokenResponse {
  email: string;
  refresh_token: string;
  access_token: string;
}

export interface IOrganizationConfig {
  id: string;
  name: string;
  plan: string;
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
export interface ILogRequest {
  request__type: string;
  request__lang: string;
  request__id: string;
  request__client: string;
  request__config__preferred_variants: ConfigProperty;
  request__config__german_gender_ending: ConfigProperty;
  response__id?: string;
  response__startOffset?: number;
  response__endOffset?: number;
  response__popOverIsOpen?: boolean;
  response__groupId?: string | null | undefined;
  response__plan?: string | null | undefined;
}
export interface IAlternativeLogRequest extends ILogRequest {
  request__replaced: string;
  request__alternative: string;
}
export interface IIgnoreLogRequest extends ILogRequest {
  request__ignored: string;
}
export interface ICheckLogRequest extends ILogRequest {
  request__text__length: number;
  // response__name: string | null;
}

export type ILogResponse = ICheckResponse;

export interface IRequest {
  url: string;
  config: RequestInit | null;
}

export interface IEndpointResponseError {
  loc: string[];
  msg: string;
  type: string;
}
export interface IEndpointError {
  status: number;
  message: string;
}
