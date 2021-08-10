import React, { useState, useEffect } from 'react';
import { MessageService } from '../MessageService';
import { IElementWithAlerts } from '../types';

const Highlights = () => {
  const [elementWithAlerts, setElementWithAlerts] =
    useState<IElementWithAlerts>({
      // cloneElement: null,
      // originalElement: null,
      element: null,
      alerts: [],
    });
  const [rects, setRects] = useState<DOMRect[]>([]);

  useEffect(() => {
    // Subscribe to the message service
    const subscription = MessageService.onMessage().subscribe(
      (message: IElementWithAlerts) => {
        if (message) {
          setElementWithAlerts(message);
        } else {
          // clear messages when empty message received
          setElementWithAlerts({
            // cloneElement: null,
            // originalElement: null,
            element: null,
            alerts: [],
          });
        }
      }
    );

    // return unsubscribe method to execute when component unmounts
    return subscription.unsubscribe;
  }, []);

  useEffect(() => {
    console.log('elementWithAlerts = ', elementWithAlerts);

    // const element = elementWithAlerts.cloneElement;
    // const originalElement = elementWithAlerts.originalElement;
    const element = elementWithAlerts.element;

    if (element !== null) {
      const nodeText = element.childNodes[0];
      console.log('nodeText = ', nodeText);

      const rects = elementWithAlerts.alerts
        .map((alert) => {
          console.log('alert = ', alert);

          const range = document.createRange();
          console.log('range 1 = ', range);

          range.setStart(nodeText, alert.startOffset);
          range.setEnd(nodeText, alert.endOffset);

          console.log('range 2 = ', range);
          console.log('range.getClientRects() = ', range.getClientRects());

          const rect = range.getClientRects()[0];
          console.log('rect = ', rect);

          return rect;
        })
        .filter((rect) => {
          //const elementToTrack = originalElement === null ? element : originalElement;
          //TODO We need the original!!!

          console.log(rect.top + rect.height, element?.offsetTop);

          return (
            rect.top + rect.height > element?.offsetTop &&
            rect.top + rect.height < element?.offsetTop + element?.clientHeight
          );
        });

      setRects(rects);
    }
  }, [elementWithAlerts]);

  return (
    <div>
      {rects.map((rect, index) => (
        <div
          key={index}
          style={{
            position: 'fixed',
            top: rect.top + rect.height,
            left: rect.left,
            width: rect.width,
            height: '3px',
            backgroundColor: 'purple',
          }}
        ></div>
      ))}
    </div>
  );
};

export default Highlights;
