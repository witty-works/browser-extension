import React, { useState, useEffect } from 'react';
import { MessageService } from '../MessageService';
import { IElementWithAlerts } from '../types';
import Highlight, { HighlightProps } from './Highlight/Highlight';

const Highlights = () => {
  const [elementWithAlerts, setElementWithAlerts] =
    useState<IElementWithAlerts>({
      cloneElement: null,
      originalElement: null,
      alerts: [],
    });
  const [highlights, setHighlights] = useState<HighlightProps[]>([]);

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
          const elementToTrackRect = (
            originalElement === null ? element : originalElement
          ).getBoundingClientRect();

          return (
            alert.rect.top + alert.rect.height > elementToTrackRect.top &&
            alert.rect.top + alert.rect.height <
              elementToTrackRect.top + elementToTrackRect.height &&
            alert.rect.left > elementToTrackRect.left &&
            alert.rect.left + alert.rect.width <
              elementToTrackRect.left + elementToTrackRect.width
          );
        });

      setHighlights(highlights);
    }
  }, [elementWithAlerts]);

  return (
    <div>
      {highlights.map((highlight, index) => (
        // <div
        //   key={index}
        //   style={{
        //     position: 'fixed',
        //     top: rect.top + rect.height,
        //     left: rect.left,
        //     width: rect.width,
        //     height: '3px',
        //     backgroundColor: 'purple',
        //   }}
        // ></div>
        <Highlight
          key={index}
          alertID={highlight.alertID}
          rect={highlight.rect}
          data={highlight.data}
        />
      ))}
    </div>
  );
};

export default Highlights;
