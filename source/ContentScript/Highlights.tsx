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

import React, { useEffect, useRef, useContext } from 'react';
import { IAlert, IAlertContentData } from '../shared/types';
import { getColor } from '../shared/constants';
import { ScrollOffsetContext } from './ContentScriptApp';

interface HighlightsProps {
  // element: HTMLDivElement;
  elementChildNodes: NodeListOf<ChildNode>;
  elementRect: DOMRect;
  alerts: IAlert[];
}

type Highlight = {
  // alertID: string;
  rect: DOMRect;
  data: IAlertContentData;
};

const Highlights: React.FC<HighlightsProps> = ({
  elementRect,
  elementChildNodes,
  alerts,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const documentScrollOffset = useContext(ScrollOffsetContext);

  useEffect(() => {
    // console.log('Highlights ============================================ ');
    // console.log('Highlights ALERTS = ', alerts);
    // console.log('Highlights elementRect = ', elementRect);
    // console.log('Highlights elementChildNodes = ', elementChildNodes);
    // console.log('Highlights documentScrollOffset = ', documentScrollOffset);

    const highlights: Highlight[] = [];

    const convertAlertToHighlight = (
      node: ChildNode,
      nodeStartPos: number,
      nodeEndPos: number
    ): void => {
      alerts.forEach((alert: IAlert) => {
        // console.log(
        //   'Highlights alert.startOffset / alert.endOffset = ',
        //   alert.startOffset,
        //   alert.endOffset
        // );
        // console.log(
        //   'Highlights nodeStartPos / nodeEndPos = ',
        //   nodeStartPos,
        //   nodeEndPos
        // );
        if (
          alert.startOffset >= nodeStartPos &&
          alert.endOffset <= nodeEndPos
        ) {
          const newStartingPos: number = alert.startOffset - nodeStartPos;
          const newEndPos: number = alert.endOffset - nodeStartPos;

          // console.log('Highlights aaa newStartingPos = ', newStartingPos);
          // console.log('Highlights aaa newEndPos = ', newEndPos);

          // console.log('Highlights aaa node = ', node);

          const range = document.createRange();
          range.setStart(node, newStartingPos);
          range.setEnd(node, newEndPos);

          // console.log(
          //   'Highlights aaa range.getClientRects() = ',
          //   range.getClientRects()
          // );

          const rect = range.getClientRects()[0];

          // console.log('Highlights aaa rect = ', rect);

          if (
            rect.top + rect.height > elementRect.top - documentScrollOffset.y &&
            rect.top + rect.height < elementRect.top + elementRect.height &&
            rect.left > elementRect.left - documentScrollOffset.x &&
            rect.left + rect.width < elementRect.left + elementRect.width
          ) {
            // console.log('Highlights aaa alert = ', alert);

            const newHighlight: Highlight = {
              rect,
              data: alert.data,
            };

            highlights.push(newHighlight);
          }

          // const newHighlight: Highlight = {
          //   rect,
          //   data: alert.data,
          // };

          // highlights.push(newHighlight);
        }
      });

      // console.log('Highlights aaa highlights FINAL = ', highlights);
    };

    let textstartingPosition: number = 0;
    let textEndPosition: number = 0;

    const traverseNodes = (nodes: NodeListOf<ChildNode>) => {
      for (let node of nodes) {
        // console.log('*** Highlights node = ', node);
        textstartingPosition = textEndPosition;
        // console.log(
        //   '*** Highlights textstartingPosition = ',
        //   textstartingPosition
        // );
        if (node.nodeName === '#text') {
          if (node.nodeValue) {
            // console.log('*** Highlights text = ', node.nodeValue);
            const nodeValueLength = node.nodeValue.length;
            textEndPosition = textstartingPosition + nodeValueLength;
            // console.log('*** Highlights textEndPosition 1 = ', textEndPosition);
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

          // console.log('*** Highlights textEndPosition 2 = ', textEndPosition);

          if (node.childNodes.length > 0) {
            traverseNodes(node.childNodes);
          }
        }
      }
    };

    traverseNodes(elementChildNodes);

    if (highlights.length <= alerts.length) {
      // console.log('--->>> Highlights highlights = ', highlights);

      const canvas: HTMLCanvasElement = canvasRef.current;

      if (canvas && canvas.getContext) {
        const context: CanvasRenderingContext2D | null =
          canvas.getContext('2d');

        // console.log('Highlights context = ', context);

        if (context) {
          //Clear the whole canvas first
          context.clearRect(0, 0, canvas.width, canvas.height);

          //Draw a rectangle for each highlight
          highlights.forEach((highlight) => {
            context.fillStyle = `${getColor(highlight.data.category)}`;
            const highlightRect = highlight.rect;
            const rectToRender: DOMRect = {
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
  }, [elementRect, elementChildNodes, alerts, documentScrollOffset]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'fixed',
          overflow: 'auto',
          top: `${elementRect.top - documentScrollOffset.y}px`,
          left: `${elementRect.left - documentScrollOffset.x}px`,
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
