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

  function drawHighlight(context: CanvasRenderingContext2D, roundedHighlight: any, color: string, x: number, y: number, width: number, height: number) {
    context.clearRect(x - 1, y - 1, width + 2, height + 2); // clear the previous rectangle (hover)
    context.fillStyle = color;
    context.fill(roundedHighlight)
  }

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
        context.clearRect(0, 0, canvas.width, canvas.height);

        //Draw a rectangle for each highlight
        highlights.forEach((highlight) => {
          highlight.rects.forEach((rect: DOMRect) => {
            let x = rect.left - elementRect.left;
            let y = rect.top - elementRect.top;
            let width = rect.width;
            let height = rect.height;
            let radius = 4;

            //making the highlight shape with rounded corners
            const roundedHighlight = new Path2D();
            roundedHighlight.moveTo(x + radius, y);
            roundedHighlight.arcTo(x + width, y, x + width, y + height, radius);
            roundedHighlight.arcTo(x + width, y + height, x, y + height, radius);
            roundedHighlight.arcTo(x, y + height, x, y, radius);
            roundedHighlight.arcTo(x, y, x + width, y, radius);

            drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).highlight}`, x, y, width, height);

            //hover effect
            // canvas.addEventListener('mousemove', function (e) {
            //   if (context.isPointInPath(roundedHighlight, e.offsetX, e.offsetY)) {
            //     drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).hover}`, x, y, width, height);
            //   } else {
            //     drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).highlight}`, x, y, width, height);
            //   }
            // });
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
      style={{
        position: 'absolute',
        overflow: 'auto',
        left: `${elementRect.left}px`,
        top: `${elementRect.top}px`,
        pointerEvents: 'none',
        zIndex: 9999998,
      } as React.CSSProperties}
      width={elementRect.width}
      height={elementRect.height}
    >
    </canvas>
  );
};

export default Highlights;