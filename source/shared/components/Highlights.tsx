import React, { useState, useEffect, useRef } from 'react';
import {
  Iinput,
  IAlert,
  IAlertContentData,
  CustomInputElement,
} from '../types';

import { getColor } from '../constants';

type Highlight = {
  alertID: string;
  rect: DOMRect;
  data: IAlertContentData;
};

const Highlights: React.FC<Iinput> = ({
  divElement,
  inputElement,
  alerts,
}: Iinput) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const [elementToTrack, setElementToTrack] =
    useState<CustomInputElement | null>(null);
  const [elementToTrackRect, setElementToTrackRect] = useState<DOMRect>(
    {} as DOMRect
  );

  useEffect(() => {
    setElementToTrack(
      typeof inputElement === 'undefined' || inputElement === null
        ? divElement
        : inputElement
    );
  }, []);

  useEffect(() => {
    if (elementToTrack)
      setElementToTrackRect(elementToTrack.getBoundingClientRect());
  }, [elementToTrack]);

  useEffect(() => {
    if (elementToTrack) {
      // const elementToTrackRect = elementToTrack.getBoundingClientRect();
      const nodeText = divElement.childNodes[0];

      const highlights: Highlight[] = alerts
        .filter(
          //filter out repeating cases
          (alert: IAlert, index: number, array: IAlert[]) =>
            array.findIndex(
              (item) =>
                item.data.text === alert.data.text &&
                item.startOffset === alert.startOffset &&
                item.endOffset === alert.endOffset
            ) === index
        )
        .map((alert: IAlert) => {
          const range = document.createRange();
          range.setStart(nodeText, alert.startOffset);
          range.setEnd(nodeText, alert.endOffset);
          const rect = range.getClientRects()[0];
          return {
            alertID: alert.id,
            rect,
            data: alert.data,
          };
        })
        .filter((alert) => {
          return (
            alert.rect.top + alert.rect.height > elementToTrackRect.top &&
            alert.rect.top + alert.rect.height <
              elementToTrackRect.top + elementToTrackRect.height &&
            alert.rect.left > elementToTrackRect.left &&
            alert.rect.left + alert.rect.width <
              elementToTrackRect.left + elementToTrackRect.width
          );
        });

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
              x: highlightRect.x - elementToTrackRect.x,
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
  }, [alerts]);

  return elementToTrack && alerts.length > 0 ? (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'fixed',
          overflow: 'auto',
          top: `${elementToTrackRect.top}px`,
          left: `${elementToTrackRect.left}px`,
          pointerEvents: 'none',
          // outline: '3px solid blue',
        } as React.CSSProperties
      }
      width={elementToTrackRect.width}
      height={elementToTrackRect.height}
    ></canvas>
  ) : null;
};

export default Highlights;
