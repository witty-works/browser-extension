import React, { useEffect } from 'react';
import { IElementWithAlerts } from '../types';
export interface HighlightsProps {
  data: IElementWithAlerts;
}

const Highlights: React.FC<HighlightsProps> = ({ data }: HighlightsProps) => {
  useEffect(() => {
    const element = data.element;
    const originalElement = data.originalElement;

    if (element !== null) {
      const elementToTrackRect = (
        typeof originalElement === 'undefined' || originalElement === null
          ? element // Track the contentEditable directly
          : originalElement
      ).getBoundingClientRect();

      const nodeText = element.childNodes[0];

      const highlights = data.alerts
        .map((alert) => {
          const range = document.createRange();
          range.setStart(nodeText, alert.startOffset);
          range.setEnd(nodeText, alert.endOffset);
          const rect = range.getClientRects()[0];
          return {
            alertID: alert.id,
            rect,
            data: alert.data,
          };
        })
        .filter((alert) => {
          return (
            alert.rect.top + alert.rect.height > elementToTrackRect.top &&
            alert.rect.top + alert.rect.height <
              elementToTrackRect.top + elementToTrackRect.height &&
            alert.rect.left > elementToTrackRect.left &&
            alert.rect.left + alert.rect.width <
              elementToTrackRect.left + elementToTrackRect.width
          );
        });

      const canvas: HTMLCanvasElement = document.getElementById(
        'canvas-highlights'
      ) as HTMLCanvasElement;

      if (canvas && canvas.getContext) {
        const context: CanvasRenderingContext2D | null =
          canvas.getContext('2d');
        if (context) {
          //Clear the whole canvas first
          context.clearRect(0, 0, canvas.width, canvas.height);

          //Draw a rectangle for each highlight
          highlights.forEach((highlight) => {
            context.fillStyle = 'rgb(88, 0, 208)'; //TODO color constant

            const highlightRect = highlight.rect;

            const rectToRender: DOMRect = {
              x: highlightRect.x - elementToTrackRect.x,
              y: highlightRect.y - canvas.offsetTop + highlightRect.height,
              width: highlightRect.width,
              height: 2,
            } as DOMRect;

            context.fillRect(
              rectToRender.x,
              rectToRender.y,
              rectToRender.width,
              rectToRender.height
            );
          });
        }
      } else {
        //TODO Provide Canvas Fallback content?
        //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
      }
    }
  }, [data]);

  const originalElement = data.originalElement;
  const originalElementRect = originalElement
    ? originalElement.getBoundingClientRect()
    : null;

  return originalElement && originalElementRect ? (
    <canvas
      id='canvas-highlights'
      style={
        {
          position: 'fixed',
          overflow: 'auto',
          top: `${originalElementRect.top}px`,
          left: `${originalElementRect.left}px`,
          pointerEvents: 'none',
          // outline: '3px solid blue',
        } as React.CSSProperties
      }
      width={originalElementRect.width}
      height={originalElementRect.height}
    ></canvas>
  ) : null;
};

export default Highlights;
