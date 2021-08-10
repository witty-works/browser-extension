export interface IAlert {
  id: string;
  startOffset: number;
  endOffset: number;
}

export interface IElementWithAlerts {
  // cloneElement: HTMLDivElement | null,
  // originalElement: HTMLTextAreaElement | HTMLInputElement | null,
  element: HTMLDivElement | HTMLInputElement | null,
  alerts: IAlert[]
}

export interface IRequest {
  url: string,
  config: RequestInit
}

export interface IEntities {
  start: number,
  end: number,
  type: string,
  type: string
}
export interface IEntitiesResponse {
  entities: IEntities[],
  language: string
}

export interface IEntitiesError {
  loc: string[],
  msg: string,
  type: string
}
export interface IEntitiesResponseError {
  detail: IEntitiesError[]
}