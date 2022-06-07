import React, { useState, useEffect, useRef } from 'react';

import { Highlight, IAlert, INodeWithAlerts, Position } from '../shared/types';
import { getColor } from '../shared/constants';
import { nodeExistsInDOM, isTextArea, isInputText } from '../shared/DOMutils';
import { drawHighlight, drawLine, redrawText } from './highlightsUtils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { usePositionCorrection } from '../shared/customHooks/usePositionCorrection';

interface HighlightsProps {
  elementScroll: Position;
  nodesWithAlerts: INodeWithAlerts[];
  element: HTMLElement;
  selectedAlert: IAlert | null;
}

const Highlights: React.FC<HighlightsProps> = ({
  elementScroll,
  nodesWithAlerts,
  element,
  selectedAlert,
}: HighlightsProps) => {
  const doc = document.documentElement || document.body;
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const correctedPosition = usePositionCorrection(
    element,
    canvasRef.current.parentElement
  );

  const elementRect = useResizeObserver(element);
  const canvasSize = {
    width: elementRect.width,
    height: elementRect.height,
  };

  useEffect(() => {
    const highlights: Highlight[] = [];
    if (nodesWithAlerts.length === 0) setHighlights([]);

    nodesWithAlerts.forEach(({ node, alerts }) => {
      //quick fix to avoid error: check if node exists in the DOM
      //but also filter alerts that have a bigger endOffset than the length of the text
      if (typeof node !== 'undefined' && nodeExistsInDOM(node)) {
        alerts
          .filter(
            (alert: IAlert) =>
              node.textContent && alert.endOffset <= node.textContent.length
          )
          .forEach((alert: IAlert) => {
            const range = document.createRange();
            range.setStart(node, alert.startOffset);
            range.setEnd(node, alert.endOffset);
            const rects: DOMRect[] = Array.from(range.getClientRects()).map(
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
                    (isTextArea(element) || isInputText(element)
                      ? elementScroll.top
                      : 0),
                  y:
                    rect.top +
                    doc.scrollTop -
                    (isTextArea(element) || isInputText(element)
                      ? elementScroll.top
                      : 0),
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
        redrawText(params);
      } else {
        drawHighlight(params, 'transparent');
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
          top: `${correctedPosition.top}px`,
          left: `${correctedPosition.left}px`,
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
          overflow: 'auto',
          pointerEvents: 'none',
          // mixBlendMode: 'normal',   //TODO Explorer this property
          // backgroundColor: 'rgba(0,0,150,0.3)',
        } as React.CSSProperties
      }
    ></canvas>
  );
};

export default Highlights;
