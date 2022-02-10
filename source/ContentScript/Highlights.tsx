import React, { useState, useEffect, useRef } from 'react';
import { Highlight, IAlert, INodeWithAlerts, ScrollPos } from '../shared/types';
import { getColor } from '../shared/constants';
import { nodeExistsInDOM } from '../shared/utils';
import { drawHighlight, drawLine, redrawText } from './highlightsUtils';

interface HighlightsProps {
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
  elementScroll: ScrollPos;
  elementRect: DOMRect;
  nodesWithAlerts: INodeWithAlerts[];
  element: HTMLElement;
  selectedAlert: IAlert | null;
}

const Highlights: React.FC<HighlightsProps> = ({
  bodyScroll,
  parentScroll,
  elementScroll,
  elementRect,
  nodesWithAlerts,
  element,
  selectedAlert,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

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
                  top: rect.top + bodyScroll.top,
                  y: rect.top,
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
  }, [nodesWithAlerts, parentScroll, elementScroll, elementRect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    //makes the canvas ratio correct, needed to make text clear
    const ratio = window.devicePixelRatio;
    canvas.width = elementRect.width * ratio;
    canvas.height = elementRect.height * ratio;
    canvas.style.width = elementRect.width + 'px';
    canvas.style.height = elementRect.height + 'px';
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!context) return;

    context.scale(ratio, ratio);
    context.clearRect(0, 0, canvas.width, canvas.height);

    highlights.forEach((highlight) => {
      const [rect] = highlight.rects;
      const hoverColor = `${getColor(highlight.data.category).hover}`;
      const highlightColor = `${getColor(highlight.data.category).highlight}`;
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

      drawLine(params, hoverColor);

      if (highlight.id === selectedAlert?.id) {
        drawHighlight(params, highlightColor);
        drawLine(params, hoverColor);
        redrawText(params);
      } else {
        drawHighlight(params, 'transparent');
        drawLine(params, hoverColor);
      }
    });
  }, [highlights, selectedAlert]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'absolute',
          overflow: 'auto',
          left: `${elementRect.left}px`,
          top: `${elementRect.top}px`,
          //Resize the canvas blanks its content if width/height is not defined in CSS
          //https://stackoverflow.com/questions/3543358/resizing-a-html-canvas-blanks-its-contents
          width: `${elementRect.width}px`,
          height: `${elementRect.height}px`,
          zIndex: 99999999,
          pointerEvents: 'none',
          outline: '3px solid blue',
        } as React.CSSProperties
      }
    ></canvas>
  );
};

export default Highlights;
