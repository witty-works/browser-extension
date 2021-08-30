import React, { useState, useEffect } from 'react';
import { MessageService } from '../MessageService';
import { IElementWithAlerts } from '../types';
// import Highlight, { HighlightProps } from './Highlight/Highlight';

const Highlights = () => {
  const [elementWithAlerts, setElementWithAlerts] =
    useState<IElementWithAlerts>({
      element: null,
      originalElement: null,
      alerts: [],
    });

  useEffect(() => {
    // Subscribe to the message service
    const subscription = MessageService.onMessage().subscribe(
      (message: IElementWithAlerts) => {
        if (message) {
          setElementWithAlerts(message);
        } else {
          // clear messages when empty message received
          setElementWithAlerts({
            element: null,
            originalElement: null,
            alerts: [],
          });
        }
      }
    );

    // return unsubscribe method to execute when component unmounts
    return subscription.unsubscribe;
  }, []);

  useEffect(() => {
    const element = elementWithAlerts.element;
    const originalElement = elementWithAlerts.originalElement;

    if (element !== null) {
      const elementToTrackRect = (
        typeof originalElement === 'undefined' || originalElement === null
          ? element // Track the contentEditable directly
          : originalElement
      ) // Track the Textarea
        .getBoundingClientRect();

      const nodeText = element.childNodes[0];

      const highlights = elementWithAlerts.alerts
        .map((alert) => {
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

      const canvas: HTMLCanvasElement = document.getElementById(
        'canvas-highlights'
      ) as HTMLCanvasElement;

      if (canvas && canvas.getContext) {
        const context: CanvasRenderingContext2D | null =
          canvas.getContext('2d');
        if (context) {
          //Clear the whole canvas first
          context.clearRect(0, 0, canvas.width, canvas.height);

          //Draw a rectangle for each highlight
          highlights.forEach((highlight) => {
            context.fillStyle = 'rgb(88, 0, 208)';

            const highlightRect = highlight.rect;

            const rectToRender: DOMRect = {
              x: highlightRect.x - elementToTrackRect.x + 1,
              y: highlightRect.y - canvas.offsetTop + highlightRect.height + 1,
              width: highlightRect.width,
              height: 3,
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

      // setHighlights(highlights);
    }
  }, [elementWithAlerts]);

  // useEffect(() => {
  //   const canvas: HTMLCanvasElement = document.getElementById(
  //     'canvas-highlights'
  //   ) as HTMLCanvasElement;

  //   if (canvas && canvas.getContext) {
  //     const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  //     highlights.forEach((highlight) => {

  //       context.fillStyle = 'rgb(88, 0, 208)';
  //       const rect:DOMRect = {
  //         x: elementWithAlerts.element.rect
  //       } as DOMRect;
  //       console.log('* highlight rect = ', highlight.rect);
  //       context.fillRect(5, 5, rect.width, 3);
  //     });
  //   } else {
  //     //TODO Provide Canvas Fallback content?
  //     //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
  //   }
  // }, [highlights]);

  const originalElement = elementWithAlerts.originalElement;
  const originalElementRect = originalElement
    ? originalElement.getBoundingClientRect()
    : null;

  return originalElement && originalElementRect ? (
    <canvas
      id='canvas-highlights'
      style={
        {
          position: 'fixed',
          overflow: 'auto',
          top: `${originalElementRect.top}px`,
          left: `${originalElementRect.left}px`,
          outline: '3px solid blue',
          pointerEvents: 'none',
        } as React.CSSProperties
      }
      width={originalElementRect.width}
      height={originalElementRect.height}
    ></canvas>
  ) : null;

  // <div>
  //   <div id='highlights'>
  //     {highlights.map((highlight, index) => (
  //       <Highlight
  //         key={index}
  //         alertID={highlight.alertID}
  //         rect={highlight.rect}
  //         data={highlight.data}
  //       />
  //     ))}
  //   </div>
  //   {elementWithAlerts.element ? (
  //     <canvas
  //       id='canvas-highlights'
  //       width={elementWithAlerts?.element?.getBoundingClientRect().width}
  //       height={elementWithAlerts?.element?.getBoundingClientRect().height}
  //     ></canvas>
  //   ) : null}
  // </div>
};

export default Highlights;
