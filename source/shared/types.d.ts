export interface IAlert {
  id: string;
  startOffset: number;
  endOffset: number;
}

export interface IElementWithAlerts {
  element: HTMLDivElement | null,
  alerts: IAlert[]
}