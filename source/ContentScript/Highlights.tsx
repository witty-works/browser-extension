import React, { useEffect, useRef } from 'react';
import { IAlert, IAlertContentData, INodeWithAlerts } from '../shared/types';
import { getColor } from '../shared/constants';
import { elementExistsinDOM } from '../shared/utils';

interface HighlightsProps {
  elementScroll: ScrollPos;
  elementRect: DOMRect;
  nodesWithAlerts: INodeWithAlerts[];
}

type Highlight = {
  rects: DOMRect[];
  data: IAlertContentData;
};

export type ScrollPos = {
  top: number;
  left: number;
};

const Highlights: React.FC<HighlightsProps> = ({
  elementScroll,
  elementRect,
  nodesWithAlerts,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const customDoc = document.documentElement || document.body;

  useEffect(() => {
    const highlights: Highlight[] = [];

    nodesWithAlerts.forEach((nodeWithAlerts) => {
      const node = nodeWithAlerts.node;

      //quick fix to avoid error: check if node exists in the DOM
      //but also filter alerts that have a bigger endOffset than the length of the text
      if (typeof node !== 'undefined' && elementExistsinDOM(node)) {
        nodeWithAlerts.alerts
          .filter(
            (alert: IAlert) =>
              node.textContent !== null &&
              alert.endOffset <= node.textContent.length
          )
          .forEach((alert: IAlert) => {
            const range = document.createRange();
            range.setStart(node, alert.startOffset);
            range.setEnd(node, alert.endOffset);

            const rects: DOMRect[] = Array.from(range.getClientRects())
              .filter((rect: DOMRect) => {
                const rectTop = rect.top + customDoc.scrollTop + rect.height;
                const rectLeft = rect.left + customDoc.scrollLeft;
                return (
                  rectTop > elementRect.top &&
                  rectTop < elementRect.top + elementRect.height &&
                  rectLeft >= elementRect.left &&
                  rectLeft + rect.width <= elementRect.left + elementRect.width
                );
              })
              .map((rect: DOMRect) => {
                return {
                  ...rect,
                  bottom: rect.top + customDoc.scrollTop + rect.height,
                  height: rect.height,
                  left: rect.left + customDoc.scrollLeft - elementScroll.left,
                  right: rect.left + customDoc.scrollLeft + rect.width,
                  top: rect.top + customDoc.scrollTop - elementScroll.top,
                  width: rect.width,
                  x: rect.left + customDoc.scrollLeft,
                  y: rect.top + customDoc.scrollTop,
                };
              });

            const newHighlight: Highlight = {
              rects,
              data: alert.data,
            };

            highlights.push(newHighlight);
          });
      }
    });

    const canvas: HTMLCanvasElement = canvasRef.current;

    if (canvas && canvas.getContext) {
      const context: CanvasRenderingContext2D | null = canvas.getContext('2d');

      if (context) {
        //Clear the whole canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);

        //Draw a rectangle for each highlight...
        highlights.forEach((highlight) => {
          context.fillStyle = `${getColor(highlight.data.category)}`;

          //... which can include several DOMRects
          highlight.rects.forEach((rect: DOMRect) => {
            const rectToRender: DOMRect = {
              x: rect.x - elementRect.x,
              y: rect.y - elementRect.y + rect.height,
              width: rect.width,
              height: 2,
            } as DOMRect;

            context.fillRect(
              rectToRender.x,
              rectToRender.y,
              rectToRender.width,
              rectToRender.height
            );
          });
        });
      }
    } else {
      //TODO Provide Canvas Fallback content?
      //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
    }
  }, [elementRect, elementScroll, nodesWithAlerts]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'absolute',
          overflow: 'auto',
          top: `${elementRect.top}px`,
          left: `${elementRect.left}px`,
          pointerEvents: 'none',
          zIndex: 999999999,
          // outline: '3px solid blue',
        } as React.CSSProperties
      }
      width={elementRect.width}
      height={elementRect.height}
    ></canvas>
  );
};

export default Highlights;
