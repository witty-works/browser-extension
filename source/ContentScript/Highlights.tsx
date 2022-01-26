import React, { useState, useEffect, useRef } from 'react';
import { IAlert, IAlertContentData, INodeWithAlerts } from '../shared/types';
import { getColor } from '../shared/constants';
import { elementExistsinDOM } from '../shared/utils';

export type ScrollPos = {
  top: number;
  left: number;
};
interface HighlightsProps {
  // element: HTMLElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
  elementScroll: ScrollPos;
  elementRect: DOMRect;
  nodesWithAlerts: INodeWithAlerts[];
}

type Highlight = {
  rects: DOMRect[];
  data: IAlertContentData;
  startOffset: number,
  endOffset: number,
  node: HTMLElement;
};

const Highlights: React.FC<HighlightsProps> = ({
  // element,
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

  // function redrawText(context: CanvasRenderingContext2D, element: HTMLElement, highlight: Highlight, x: number, y: number, height: number) {
  //   const style = window.getComputedStyle(element);
  //   context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
  //   context.fillStyle = style.color;
  //   context.textBaseline = "bottom";

  //   context.fillText(highlight.data.text, x, y + height - 1);
  // }

  useEffect(() => {
    const highlights: Highlight[] = [];
    nodesWithAlerts.forEach(({ node, alerts }) => {

      //quick fix to avoid error: check if node exists in the DOM
      //but also filter alerts that have a bigger endOffset than the length of the text
      if (typeof node !== 'undefined' && elementExistsinDOM(node)) {
        alerts
          .filter(
            (alert: IAlert) =>
              node.textContent &&
              alert.endOffset <= node.textContent.length
          )
          .forEach((alert: IAlert) => {
            const range = document.createRange();
            range.setStart(node, alert.startOffset);
            range.setEnd(node, alert.endOffset);
            const rects: DOMRect[] = Array.from(range.getClientRects())
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
              startOffset: alert.startOffset,
              endOffset: alert.endOffset,
              node: node,
            };

            highlights.push(newHighlight);
          });
      }
    });
    setHighlights(highlights)
  }, [nodesWithAlerts, parentScroll, elementScroll]);


  useEffect(() => {
    const canvas: HTMLCanvasElement = canvasRef.current;
    if (canvas) {
      //makes the ratio correct, needed to make text clear
      // let ratio = window.devicePixelRatio;
      // canvas.width = elementRect.width * ratio;
      // canvas.height = elementRect.height * ratio;
      // canvas.style.width = elementRect.width + "px";
      // canvas.style.height = elementRect.height + "px";


      const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
      if (context) {
        // context.scale(ratio, ratio)
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.globalAlpha = 0.3;

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
            // redrawText(context, element, highlight, x, y, height);

            //hover highlight
            // canvas.addEventListener('mousemove', function (e) {
            //   console.log('mouse')
            //   //TODO: make sure old locations of highligh is removed 
            //   if (context.isPointInPath(roundedHighlight, e.offsetX * ratio, e.offsetY * ratio)) {
            //     drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).hover}`, x, y, width, height);
            //     redrawText(context, element, highlight, x, y, height);
            //   } else {
            //     drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).highlight}`, x, y, width, height);
            //     redrawText(context, element, highlight, x, y, height);
            //   }
            // });

            //click highlight
            // canvas.addEventListener('click', function (event) {
            //   //TODO: also open for double click 
            //   if (context.isPointInPath(roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
            //     console.log('click on highlight')
            //     setModalData({
            //       alert: highlight,
            //       position: highlight.rects[0],
            //       node: highlight.node,
            //       originalNode: null
            //     });
            //     setIsOpen(!isOpen);
            //     //remove highlight if no longer necessary
            //     // redrawText(context, element, highlight, x, y, height);
            //   }
            //   else {
            //     canvas.style.pointerEvents = 'none';
            //     console.log('click outside highlight')
            //     element.focus();
            //     setTimeout(() => {
            //       canvas.style.pointerEvents = 'auto';
            //     }, 1000);
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
        zIndex: 999999999,
      } as React.CSSProperties}
      width={elementRect.width}
      height={elementRect.height}
    >
    </canvas>
  );
};

export default Highlights;