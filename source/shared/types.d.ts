export interface RequestConfig {
  primary_language: string;
  preferred_languages: string;
  preferred_variants: string;
  german_gender_ending: string;
  disabled_categories: string[];
  maximum_importance: number;
  singular_they: string;
  show_inspiration_alternatives: boolean;
}

export interface ConfigProperty {
  value: string | string[] | boolean | number;
  status?: string;
}
export interface ScrollPos {
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
  language: string;
}

// export interface IOrganizationConfig {
//   primary_language: string;
//   preferred_languages: string[];
//   preferred_variants: string[];
//   german_gender_ending: string;
//   gendered_roles_format: string;
//   disabled_categories: string[];
//   singular_they: string;
//   show_inspiration_alternatives: boolean;
//   maximum_importance: number;
// }
// export interface IAuthResponse {
//   forced: IOrganizationConfig;
//   suggestion: IOrganizationConfig;
//   id: string;
//   name: string;
//   plan: string;
//   store_context: boolean;
// }

export interface IAuthResponse {
  config: {
    gender_roles_format: ConfigProperty;
    german_gender_ending: ConfigProperty;
    inclusive: ConfigProperty;
    maximum_importance: ConfigProperty;
    orthography: ConfigProperty;
    preferred_variants: ConfigProperty;
    show_inspiration_alternatives: ConfigProperty;
    singular_they: ConfigProperty;
    store_context: ConfigProperty;
    style: ConfigProperty;
  };
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
}
export interface ILogRequest {
  request__type: string;
  request__lang: string;
  request__id: string;
  request__client: string;
  request__config__primary_language: string;
  request__config__preferred_languages: string;
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
  config: RequestInit;
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
