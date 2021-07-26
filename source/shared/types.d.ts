export interface IAlert {
  id: string;
  startOffset: number;
  endOffset: number;
}

export interface IElementWithAlerts {
  element: HTMLDivElement | null,
  originalElement: HTMLTextAreaElement | HTMLInputElement | null,
  alerts: IAlert[]
}