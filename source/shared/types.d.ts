export interface RequestConfig {
  primary_language: string,
  preferred_languages: string,
  preferred_variants: string,
  german_gender_ending: string,
}

export type CustomInputElement =
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLDivElement;

export interface INodeWithAlerts {
  node:HTMLElement,
  alerts:IAlert[],
}
export interface IAlert {
  id: string,
  startOffset: number,
  endOffset: number,
  originalStartOffset: number,
  originalEndOffset: number,
  data: IAlertContentData,
}
export interface IAlertContentData {
  language: string,
  category: string,
  subcategory: string,
  context: string,
  text: string,
  label: string,
  reason: string,
  solution: string,
  alternatives: string[],
}

export interface ILogRequest {
  request__type: string,
  request__lang: string,
  request__id: string,
  request__client: string,
  request__config__primary_language: string,
  request__config__preferred_languages: string,
  request__config__preferred_variants: string,
  request__config__german_gender_ending: string,
}
export interface IAlternativeLogRequest extends ILogRequest {
  request__replaced: string,
  request__alternative: string,
}
export interface IIgnoreLogRequest extends ILogRequest {
  request__ignored: string,
}
export interface ICheckLogRequest extends ILogRequest {
  request__text__length: number,
}
export interface ILogResponse {
  results: ILogResponseResult[],
  language: string,
}
export interface ILogResponseResult {
  text: string,
  context: string,
  category: string,
  subcategory: string,
  start: number,
  end: number,
  alternatives: string[],
  label: string,
  reason: string,
  solution: string,
}

export interface IRequest {
  url: string,
  config: RequestInit,
}

export interface IEndpointResult {
  start: number,
  end: number,
  category: string,
  text: string,
  label: string,
  reason: string,
  solution: string,
}
export interface IEndpointResultError {
  loc: string[],
  msg: string,
  type: string,
}
export interface IEndpointResponseError {
  detail: IEndpointResultError[],
}