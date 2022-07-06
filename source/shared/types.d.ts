export interface RequestConfig {
  preferred_variants: string;
  german_gender_ending: string;
  disabled_categories: string[];
  maximum_importance: number;
  singular_they: string;
  show_inspiration_alternatives: boolean;
  gendered_roles_format: string;
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
  data: IAlertContentData;
  groupId?: string | null;
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
  organization_config: IAuthResponse;
  language: string;
  limit_reached: boolean;
  organization_config: IOrganizationConfig;
}
export interface IAuthResponse {
  config: {
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
  };
  id: string;
  name: string;
  plan: string;
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
  request__config__preferred_variants: string;
  request__config__german_gender_ending: string;
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
