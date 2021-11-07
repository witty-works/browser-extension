export type CustomInputElement =
  | HTMLTextAreaElement
  | HTMLInputElement
  | HTMLDivElement;

export interface INodeWithAlerts {
  node:HTMLElement;
  alerts:IAlert[];
}
export interface IAlert {
  id: string;
  startOffset: number;
  endOffset: number;
  originalStartOffset: number;
  originalEndOffset: number;
  data: IAlertContentData;
}
export interface IAlertContentData {
  category: string;
  text: string;
  label: string;
  reason: string;
  solution: string;
  alternatives: string[];
}

export interface IAlternative {
  text: string;
  alternative: string;
  start: number;
  end: number;
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
export interface IEndpointResultError {
  loc: string[],
  msg: string,
  type: string
}
export interface IEndpointResponseError {
  detail: IEndpointResultError[]
}


