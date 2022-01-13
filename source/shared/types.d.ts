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
  type: string,
  lang: string,
  id: string,
  client: string,
  config: object,
  text: object,
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