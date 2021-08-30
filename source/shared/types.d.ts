export type CustomInputElement = HTMLTextArea | HTMLInputElement | HTMLDivElement;
export interface IElement {
  element: HTMLTextAreaElement | HTMLInputElement | HTMLDivElement | null
}
export interface IAlert {
  id: string;
  startOffset: number;
  endOffset: number;
  data: IAlertContentData
}
export interface IAlertContentData {
  category: string,
  text: string,
  label: string,
  reason: string,
  solution: string,
}
export interface IElementWithAlerts {
  element: HTMLDivElement | null,
  originalElement?: HTMLTextAreaElement | HTMLInputElement | null,
  alerts: IAlert[]
}

export interface IRequest {
  url: string,
  config: RequestInit
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
export interface IEndpointResponse {
  results: IEndpointResult[],
  language: string
}

export interface IEndpointResultError {
  loc: string[],
  msg: string,
  type: string
}
export interface IEndpointResponseError {
  detail: IEndpointResultError[]
}

// export interface IExtensionMessage {
//   command: string,
//   value: string
// }
