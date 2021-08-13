import React, { useState, useEffect } from 'react';
import { MessageService } from '../MessageService';
import { IElementWithAlerts } from '../types';

const Highlights = () => {
  const [elementWithAlerts, setElementWithAlerts] =
    useState<IElementWithAlerts>({
      cloneElement: null,
      originalElement: null,
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
            cloneElement: null,
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
    const element = elementWithAlerts.cloneElement;
    const originalElement = elementWithAlerts.originalElement;

    if (element !== null) {
      const nodeText = element.childNodes[0];

      const rects = elementWithAlerts.alerts
        .map((alert) => {
          const range = document.createRange();
          range.setStart(nodeText, alert.startOffset);
          range.setEnd(nodeText, alert.endOffset);
          const rect = range.getClientRects()[0];
          return rect;
        })
        .filter((rect) => {
          const elementToTrackRect = (
            originalElement === null ? element : originalElement
          ).getBoundingClientRect();

          return (
            rect.top + rect.height > elementToTrackRect.top &&
            rect.top + rect.height <
              elementToTrackRect.top + elementToTrackRect.height &&
            rect.left > elementToTrackRect.left &&
            rect.left + rect.width <
              elementToTrackRect.left + elementToTrackRect.width
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
