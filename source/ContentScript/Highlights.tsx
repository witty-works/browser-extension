import React, { useEffect, useRef } from 'react';
import { IAlert, IAlertContentData, INodeWithAlerts } from '../shared/types';
import { getColor } from '../shared/constants';
import { elementExistsinDOM } from '../shared/utils';

interface HighlightsProps {
  documentScroll: ScrollPos;
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
  documentScroll,
  elementScroll,
  elementRect,
  nodesWithAlerts,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  // const customDoc = document.documentElement || document.body;

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
              //     rect.left /* + customDoc.scrollLeft */ + documentScroll.left;
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
                console.log('abcd rect:', rect);

                return {
                  ...rect,
                  width: rect.width,
                  height: rect.height,
                  left: rect.left,
                  x: rect.left,
                  top: rect.top,
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
            console.log('abcd witty documentScroll.top:', documentScroll.top);
            console.log('abcd witty elementScroll.top:', elementScroll.top);
            console.log('abcd witty rect.top:', rect.top);
            console.log('abcd witty elementRect.top:', elementRect.top);

            const rectToRender: DOMRect = {
              // x: rect.x,
              // y: rect.y + rect.height,
              // x: rect.x - elementRect.x,
              // y: rect.y - elementRect.y + documentScroll.top + rect.height,
              // left: rect.left - elementRect.left,
              // top:
              //   rect.top + documentScroll.top - elementRect.top + rect.height,
              left: rect.left - elementRect.left,
              top:rect.top + documentScroll.top - elementRect.top + rect.height,
              width: rect.width,
              height: 2,
            } as DOMRect;

            context.fillRect(
              rectToRender.left,
              rectToRender.top,
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
  }, [elementRect, documentScroll, elementScroll, nodesWithAlerts]);

  const isBodyRelativePositioned = () => 
    window.getComputedStyle(document.documentElement || document.body).position === 'relative' 
      ? true
      :false;
  

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'absolute',
          overflow: 'auto',
          top: `${elementRect.top - (isBodyRelativePositioned() ?  documentScroll.top : 0)}px`,
          left: `${elementRect.left - (isBodyRelativePositioned() ?  documentScroll.left : 0)}px`,
          pointerEvents: 'none',
          zIndex: 999999999,
          outline: '3px solid blue',
        } as React.CSSProperties
      }
      width={elementRect.width}
      height={elementRect.height}
    ></canvas>
  );
};

export default Highlights;
