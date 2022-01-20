import React, { useState, useEffect, useRef } from 'react';
import { IAlert, IAlertContentData, INodeWithAlerts } from '../shared/types';
import { getColor } from '../shared/constants';
import { elementExistsinDOM } from '../shared/utils';

export type ScrollPos = {
  top: number;
  left: number;
};

interface HighlightsProps {
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
  elementScroll: ScrollPos;
  elementRect: DOMRect;
  nodesWithAlerts: INodeWithAlerts[];
}

type Highlight = {
  rects: DOMRect[];
  data: IAlertContentData;
};

const Highlights: React.FC<HighlightsProps> = ({
  bodyScroll,
  parentScroll,
  elementScroll,
  elementRect,
  nodesWithAlerts,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);

  const [highlights, setHighlights] = useState<Highlight[]>([])

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
              // .filter((rect: DOMRect) => {
              //   const rectLeft =
              //     rect.left + customDoc.scrollLeft  + documentScroll.left;
              //   const rectTop =
              //     rect.top +
              //     // customDoc.scrollTop +
              //     documentScroll.top +
              //     rect.height;
              //   return (
              //     rectTop > elementRect.top &&
              //     rectTop < elementRect.top + elementRect.height &&
              //     rectLeft >= elementRect.left &&
              //     rectLeft + rect.width <= elementRect.left + elementRect.width
              //   );
              // })
              .map((rect: DOMRect) => {
                return {
                  ...rect,
                  width: rect.width,
                  height: rect.height,
                  left: rect.left,
                  x: rect.left,
                  top: rect.top + bodyScroll.top,
                  y: rect.top,
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

    setHighlights(highlights)
  }, [nodesWithAlerts, parentScroll, elementScroll]);

  useEffect(() => {
    const canvas: HTMLCanvasElement = canvasRef.current;

    if (canvas && canvas.getContext) {
      const context: CanvasRenderingContext2D | null = canvas.getContext('2d');

      if (context) {
        //Clear the whole canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);

        //Draw a rectangle for each highlight...
        highlights.forEach((highlight) => {
          // TODO: add fill behind text
          // context.globalCompositeOperation = 'destination-over';
          context.globalAlpha = 0.2;
          context.fillStyle = `${getColor(highlight.data.category)}`;

          //... which can include several DOMRects
          highlight.rects.forEach((rect: DOMRect) => {
            let x = rect.left - elementRect.left;
            let y = rect.top - elementRect.top;
            let width = rect.width;
            let height = rect.height;
            let radius = 4;

            //Needed in order to draw the rounded corners
            context.beginPath();
            context.moveTo(x + radius, y);
            context.arcTo(x + width, y, x + width, y + height, radius);
            context.arcTo(x + width, y + height, x, y + height, radius);
            context.arcTo(x, y + height, x, y, radius);
            context.arcTo(x, y, x + width, y, radius);
            context.closePath();
            context.fill();
          });
        });
      }
    } else {
      //TODO Provide Canvas Fallback content?
      //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
    }
  }, [highlights]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'absolute',
          overflow: 'auto',
          left: `${elementRect.left}px`,
          top: `${elementRect.top}px`,
          pointerEvents: 'none',
          zIndex: 999999999,
          // outline: '1px solid blue',
        } as React.CSSProperties
      }
      width={elementRect.width}
      height={elementRect.height}
    ></canvas>
  );
};

export default Highlights;

