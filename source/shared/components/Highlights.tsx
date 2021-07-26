import React, { useState, useEffect } from 'react';
import { MessageService } from '../MessageService';
import { IElementWithAlerts } from '../types';

const Highlights = () => {
  const [elementWithAlerts, setElementWithAlerts] =
    useState<IElementWithAlerts>({
      element: null,
      originalElement: null,
      alerts: [],
    });
  const [rects, setRects] = useState<DOMRect[]>([]);
  // const [elemStyle, setElemStyle] = useState<CSSStyleDeclaration>(
  //   {} as CSSStyleDeclaration
  // );

  useEffect(() => {
    // Subscribe to the message service
    const subscription = MessageService.onMessage().subscribe(
      (message: IElementWithAlerts) => {
        if (message) {
          setElementWithAlerts(message);
          // setElemStyle(
          //   window.getComputedStyle(message.element as HTMLDivElement)
          // );
          // console.log('elemStyle = ', elemStyle);
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
    const elem = elementWithAlerts.element;
    const originalElem = elementWithAlerts.originalElement;

    console.log('element = ', elem);
    console.log('element.offsetTop = ', elem?.offsetTop);

    if (elem !== null) {
      const nodeText = elem.childNodes[0];

      const rects = elementWithAlerts.alerts
        .map((alert) => {
          const range = document.createRange();

          range.setStart(nodeText, alert.startOffset);
          range.setEnd(nodeText, alert.endOffset);
          const rect = range.getClientRects()[0];

          return rect;
        })
        .filter((rect) => {
          console.log('rect.top = ', rect.top);
          console.log('originalElem.offsetTop = ', originalElem?.offsetTop);

          return (
            rect.top + rect.height > originalElem?.offsetTop &&
            rect.top + rect.height <
              originalElem?.offsetTop + originalElem?.clientHeight
          );
        });

      setRects(rects);
    }
  }, [elementWithAlerts]);

  return (
    <div
    // style={{
    //   position: 'fixed',
    //   top: elemStyle.top,
    //   left: elemStyle.left,
    //   width: elemStyle.width,
    //   height: elemStyle.height,
    //   zIndex: -1,
    //   border: '1px solid red',
    // }}
    >
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
