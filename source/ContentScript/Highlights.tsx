import React, { useEffect, useRef } from 'react';
import { IAlert, IAlertContentData } from '../shared/types';
import { getColor } from '../shared/constants';

interface HighlightsProps {
  elementScroll: ScrollPos;
  elementRect: DOMRect;
  elementChildNodes: NodeListOf<ChildNode>;
  alerts: IAlert[];
}

type Highlight = {
  // alertID: string;
  rect: DOMRect;
  data: IAlertContentData;
};

export type ScrollPos = {
  top: number;
  left: number;
};

const Highlights: React.FC<HighlightsProps> = ({
  elementScroll,
  elementRect,
  elementChildNodes,
  alerts,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const customDoc = document.documentElement || document.body;

  useEffect(() => {
    const highlights: Highlight[] = [];

    const convertAlertToHighlight = (
      node: ChildNode,
      nodeStartPos: number,
      nodeEndPos: number
    ): void => {
      console.log('Highlights ALERTS = ', alerts);

      alerts
        .sort((firstAlert: IAlert, secondAlert: IAlert) => {
          return firstAlert.startOffset < secondAlert.startOffset ? -1 : 1;
        })
        .forEach((alert: IAlert) => {
          console.log('------------ Highlights alert = ', alert.data.text);

          console.log('Highlights alert.startOffset = ', alert.startOffset);
          console.log('Highlights  alert.endOffset = ', alert.endOffset);

          if (
            alert.startOffset >= nodeStartPos &&
            alert.endOffset <= nodeEndPos
          ) {
            console.log('Highlights we ARE IN = ', alert.data.text);

            const newStartingPos: number = alert.startOffset - nodeStartPos;
            const newEndPos: number = alert.endOffset - nodeStartPos;

            const range = document.createRange();
            range.setStart(node, newStartingPos);
            range.setEnd(node, newEndPos);
            const rect = range.getClientRects()[0];

            // console.log('Highlights rect = ', rect);
            // console.log('Highlights customDoc.scrollTop = ', customDoc.scrollTop);

            const rectTop = rect.top + customDoc.scrollTop + rect.height;
            console.log('Highlights rectTop = ', rectTop);
            console.log('Highlights elementRect.top = ', elementRect.top);
            console.log('Highlights elementRect.height = ', elementRect.height);
            const rectLeft = rect.left + customDoc.scrollLeft;
            console.log('Highlights rectLeft = ', rectLeft);
            console.log('Highlights elementRect.left = ', elementRect.left);
            console.log('Highlights elementRect.width = ', elementRect.width);

            if (
              rectTop > elementRect.top &&
              rectTop < elementRect.top + elementRect.height &&
              rectLeft >= elementRect.left &&
              rectLeft + rect.width <= elementRect.left + elementRect.width
            ) {
              const newRect: DOMRect = {
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

              const newHighlight: Highlight = {
                rect: newRect,
                data: alert.data,
              };

              console.log('Highlights newHighlight = ', newHighlight);

              highlights.push(newHighlight);
            }
          }
        });
    };

    let textstartingPosition: number = 0;
    let textEndPosition: number = 0;

    const traverseNodes = (nodes: NodeListOf<ChildNode>) => {
      for (let node of nodes) {
        textstartingPosition = textEndPosition;

        if (node.nodeName === '#text') {
          if (node.nodeValue) {
            const nodeValueLength = node.nodeValue.length;
            textEndPosition = textstartingPosition + nodeValueLength;

            console.log(
              'highlights TRY node = ',
              node.nodeValue,
              textstartingPosition,
              textEndPosition
            );

            convertAlertToHighlight(
              node,
              textstartingPosition,
              textEndPosition
            );
          }
        } else {
          if (node.previousSibling !== null) {
            if (node.nodeName === 'DIV' || 'BR' || 'P') textEndPosition++;
          }

          if (node.childNodes.length > 0) {
            traverseNodes(node.childNodes);
          }
        }
      }
    };

    traverseNodes(elementChildNodes);

    console.log('Highlights highlights = ', highlights);

    if (highlights.length <= alerts.length) {
      const canvas: HTMLCanvasElement = canvasRef.current;

      if (canvas && canvas.getContext) {
        const context: CanvasRenderingContext2D | null =
          canvas.getContext('2d');

        if (context) {
          //Clear the whole canvas first
          context.clearRect(0, 0, canvas.width, canvas.height);

          //Draw a rectangle for each highlight
          highlights.forEach((highlight) => {
            context.fillStyle = `${getColor(highlight.data.category)}`;
            const highlightRect = highlight.rect;

            const rectToRender: DOMRect = {
              x: highlightRect.x - elementRect.x,
              y: highlightRect.y - elementRect.y + highlightRect.height,
              width: highlightRect.width,
              height: 2,
            } as DOMRect;

            // console.log('Highlights rectToRender = ', rectToRender);

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
  }, [elementRect, elementChildNodes, alerts, elementScroll]);

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

/*
import React, { useEffect, useRef } from 'react';
import { IAlertContentData } from '../shared/types';
import { getColor } from '../shared/constants';
export interface HighlightsProps {
  highlights: Highlight[];
  elementRect: DOMRect;
}

export type Highlight = {
  rect: DOMRect;
  data: IAlertContentData;
};

const Highlights: React.FC<HighlightsProps> = ({
  highlights,
  elementRect,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);

  useEffect(() => {
    if (highlights.length) {
      const canvas: HTMLCanvasElement = canvasRef.current;

      if (canvas && canvas.getContext) {
        const context: CanvasRenderingContext2D | null =
          canvas.getContext('2d');

        if (context) {
          //Clear the whole canvas first
          context.clearRect(0, 0, canvas.width, canvas.height);

          //Draw a rectangle for each highlight
          highlights.forEach((highlight) => {
            context.fillStyle = `${getColor(highlight.data.category)}`;
            const highlightRect = highlight.rect;
            const rectToRender = {
              x: highlightRect.x - elementRect.x,
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
  }, [highlights, elementRect]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'fixed',
          overflow: 'auto',
          top: `${elementRect.top}px`,
          left: `${elementRect.left}px`,
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
*/
