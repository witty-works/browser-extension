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

        var data = '<svg width="67" height="39" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient x1="-30.81%" y1="-10.124%" x2="128.763%" y2="94.225%" id="a"><stop stop-color="#F277D0" offset="29%" /><stop stop-color="#8A8FDD" offset="51%" /><stop stop-color="#37D1E5" offset="74%" /><stop stop-color="#5ACFB9" offset="92%" /></linearGradient><linearGradient x1="-41.951%" y1="-5.539%" x2="168.367%" y2="98.742%" id="b"><stop stop-color="#F277D0" offset="29%" /><stop stop-color="#8A8FDD" offset="51%" /><stop stop-color="#37D1E5" offset="74%" /><stop stop-color="#5ACFB9" offset="92%" /></linearGradient><linearGradient x1="5.052%" y1="49.54%" x2="105.76%" y2="50.408%" id="c"><stop stop-color="#5ACFB9" offset="0%" /><stop stop-color="#37D1E5" stop-opacity=".5" offset="51%" /><stop stop-color="#37D1E5" stop-opacity="0" offset="91%" /></linearGradient><linearGradient x1="-10.233%" y1="-48.953%" x2="109.319%" y2="98.229%" id="d"><stop stop-color="#F277D0" stop-opacity="0" offset="1%" /><stop stop-color="#F277D0" stop-opacity=".6" offset="23%" /><stop stop-color="#F0AAA3" offset="58%" /><stop stop-color="#FFF" stop-opacity="0" offset="92%" /></linearGradient></defs><g fill="none" fill-rule="evenodd"><path d="M45.2 38.8a6.51 6.51 0 0 1-5.71-3.3l-2.6-4.5a2.75 2.75 0 1 1 4.76-2.75l2.6 4.5a1.06 1.06 0 0 0 1 .55 1 1 0 0 0 .94-.55L60.83 7.32a1.1 1.1 0 0 0-1-1.64H44L27.52 35.46a6.6 6.6 0 0 1-11.45 0L1.39 10.07A6.6 6.6 0 0 1 7.1.18h17.95A4.7 4.7 0 0 1 29.35 3l-4.81 2.71H7.1a1.1 1.1 0 0 0-1 1.64l14.74 25.4a1 1 0 0 0 .94.55c.394.008.76-.204.95-.55L39.5 2.36A4.21 4.21 0 0 1 43.18.18h16.7a6.6 6.6 0 0 1 5.71 9.89L50.91 35.5a6.53 6.53 0 0 1-5.71 3.3Z" fill="url(#a)" /><path d="M47.54 5.68a5.64 5.64 0 0 1 .52-1.41A46.91 46.91 0 0 1 50.55.18h-7.37a4.21 4.21 0 0 0-3.68 2.18L22.73 32.75a1.06 1.06 0 0 1-.95.55 1 1 0 0 1-.94-.55L6.15 7.32a1.1 1.1 0 0 1 1-1.64h17.39L29.35 3a4.7 4.7 0 0 0-4.3-2.79H7.1a6.6 6.6 0 0 0-5.71 9.89l14.68 25.4a6.6 6.6 0 0 0 11.45 0L44 5.68h3.54Z" fill="url(#b)" /><path d="M62.66.79a42.51 42.51 0 0 0-3.78 4.89h1a1.1 1.1 0 0 1 1 1.64L46.14 32.75a1 1 0 0 1-.94.55 1.06 1.06 0 0 1-1-.55l-2.6-4.5A2.75 2.75 0 1 0 36.89 31l2.6 4.5a6.59 6.59 0 0 0 11.42 0l14.68-25.43a6.53 6.53 0 0 0 0-6.59A6.61 6.61 0 0 0 62.66.79Z" fill="url(#c)" /><path d="M29.35 3a4.7 4.7 0 0 0-4.3-2.79H11.8l2.86 5.5h9.88l5.75 13.13 3.4-6L29.35 3Z" fill="url(#d)" /></g></svg>';

        var DOMURL = window.URL || window.webkitURL || window;
        var img1 = new Image();
        var svg = new Blob([data], { type: 'image/svg+xml' });
        var url = DOMURL.createObjectURL(svg);
        img1.onload = function () {
          context.drawImage(img1, 25, 70);
          DOMURL.revokeObjectURL(url);
        }
        img1.src = url;

        // const img = document.createElement('img');
        // img.src = browser.runtime.getURL('../../assets/icons/w-logo-wire-color.svg');
        // img.classList.add('modal-icon-large');
        // img.alt = 'Witty Works Logo';
        // img.style.position = 'absolute';
        // img.style.width = '100px';
        // img.style.height = '100px';

        // context.drawImage(img, 10, 10);

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
    <>
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

    </>
  );
};

export default Highlights;