import React, { useState, useEffect } from 'react';
import { MessageService } from '../MessageService';
import { IElementWithAlerts } from '../types';

const Highlights = () => {
  // const [messages, setMessages] = useState<string[]>([]);
  const [elementWithAlerts, setElementWithAlerts] =
    useState<IElementWithAlerts>({ element: null, alerts: [] });

  const [rects, setRects] = useState<DOMRect[]>([]);

  useEffect(() => {
    // Subscribe to the message service
    const subscription = MessageService.onMessage().subscribe(
      (message: IElementWithAlerts) => {
        if (message) {
          setElementWithAlerts(message);
        } else {
          // clear messages when empty message received
          setElementWithAlerts({ element: null, alerts: [] });
        }
      }
    );

    // return unsubscribe method to execute when component unmounts
    return subscription.unsubscribe;
  }, []);

  useEffect(() => {
    const elem = elementWithAlerts.element;

    if (elem !== null) {
      const nodeText = elem.childNodes[0];

      const rects = elementWithAlerts.alerts.map((alert) => {
        const range = document.createRange();

        range.setStart(nodeText, alert.startOffset);
        range.setEnd(nodeText, alert.endOffset);
        const rect = range.getClientRects()[0];

        return rect;
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
