import React, { useState, useEffect, useRef } from 'react';

import { sendErrorToSentry } from '../shared/errorUtils';
import { Highlight, IAlert, INodeWithAlerts, Position } from '../shared/types';
import { getColor } from '../shared/constants';
import { isTextArea, nodeExistsInDOM } from '../shared/DOMutils';
import { drawHighlight, drawLine } from './highlightsUtils';
import { getCorrectedPosition } from '../shared/utils';
import { getActiveDocument } from './ContentScriptApp';

interface HighlightsProps {
  elementScroll: Position;
  nodesWithAlerts: INodeWithAlerts[];
  element: HTMLElement;
  elementRect: DOMRect;
  selectedAlert: IAlert | null;
}

const Highlights: React.FC<HighlightsProps> = ({
  elementScroll,
  nodesWithAlerts,
  element,
  elementRect,
  selectedAlert,
}: HighlightsProps) => {
  const doc = getActiveDocument().documentElement || getActiveDocument().body;
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const correctedPosition = getCorrectedPosition(
    elementRect,
    canvasRef.current.parentElement,
    element
  );
  const canvasSize = {
    width: elementRect.width,
    height: elementRect.height,
  };

  useEffect(() => {
    const highlights: Highlight[] = [];
    if (nodesWithAlerts && nodesWithAlerts.length === 0) setHighlights([]);
    console.log('nodesWithAlerts', nodesWithAlerts);
    nodesWithAlerts.forEach(({ node, alerts }) => {
      console.log('node', node);

      //get textnode
      const textNode = node.childNodes[0] as HTMLElement;

      console.log('textNode', textNode);
      //if node is div, extract text node

      if (typeof node !== 'undefined' && nodeExistsInDOM(node)) {
        alerts.forEach((alert: IAlert) => {
          const range = getActiveDocument().createRange();
          try {
            if (
              node.textContent &&
              (alert.endOffset > node.textContent.length ||
                alert.startOffset > node.textContent.length)
            )
              return;
            range.selectNode(node);
            range.setStart(node, alert.startOffset);
            range.setEnd(node, alert.endOffset);
          } catch (error) {
            sendErrorToSentry(error);
          }

          const rangeRects = [range.getClientRects()[0]];
          //if rangerects has moer than one element

          console.log('rangeRects', rangeRects[0]);
          const rects: DOMRect[] = Array.from(rangeRects).map(
            (rect: DOMRect) => {
              return {
                ...rect,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                x: rect.left,
                top:
                  rect.top +
                  doc.scrollTop -
                  (isTextArea(element) ? elementScroll.top : 0),
                y:
                  rect.top +
                  doc.scrollTop -
                  (isTextArea(element) ? elementScroll.top : 0),
              };
            }
          );

          const newHighlight: Highlight = {
            rects,
            id: alert.id,
            data: alert.data,
            startOffset: alert.startOffset,
            endOffset: alert.endOffset,
            node: node,
          };

          highlights.push(newHighlight);
        });
      }
    });

    setHighlights(highlights);
  }, [nodesWithAlerts, elementScroll, elementRect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    //makes the canvas ratio correct, needed to make text clear
    const ratio = window.devicePixelRatio;
    canvas.width = canvasSize.width * ratio;
    canvas.height = canvasSize.height * ratio;
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!context) return;

    context.scale(ratio, ratio);
    context.clearRect(0, 0, canvas.width, canvas.height);

    highlights.forEach((highlight) => {
      if (highlight.rects && highlight.rects.length === 0) return;
      console.log('highlight', highlight);

      const [rect] = highlight.rects;
      const hoverColor = `${getColor(highlight.data.gravity).default}`;
      const highlightColor = `${getColor(highlight.data.gravity).hover}`;
      const dashedLine = highlight.data.category == 'orthography';
      const roundedHighlight = new Path2D();
      const params = {
        context,
        roundedHighlight,
        highlight,
        hoverColor,
        highlightColor,
        rect,
        elementRect,
        canvas,
        element,
      };

      drawLine(params, hoverColor, dashedLine);

      if (selectedAlert && selectedAlert.id === highlight.id) {
        drawHighlight(params, highlightColor);
        drawLine(params, hoverColor, dashedLine);
      }
    });
  }, [elementRect.width, elementRect.height, highlights, selectedAlert]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'absolute',
          maxWidth: 'initial',
          top: `${correctedPosition.top}px`,
          left: `${correctedPosition.left}px`,
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
          overflow: 'auto',
          pointerEvents: 'none',
        } as React.CSSProperties
      }
    ></canvas>
  );
};

export default Highlights;
