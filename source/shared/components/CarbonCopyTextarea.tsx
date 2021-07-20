import React from 'react';
import { IAlert, IElementWithAlerts } from '../types';

import { MessageService } from '../MessageService';

export interface CarbonCopyTextareaProps {
  element: HTMLTextAreaElement | HTMLInputElement;
}

const CarbonCopyTextarea: React.FC<CarbonCopyTextareaProps> = ({
  element,
}: CarbonCopyTextareaProps) => {
  const style = window.getComputedStyle(element);

  const checkText = (text: string): IAlert[] => {
    const tokens = text.split(/([\s,.!?]+)/g);
    const alerts: IAlert[] = [];
    let curPos = 0;
    let id = 0;

    tokens.forEach((t) => {
      if (t.trim().length > 0) {
        alerts.push({
          id: (id++).toString(),
          startOffset: curPos,
          endOffset: curPos + t.length,
        });
      }

      curPos += t.length;
    });

    return alerts;
  };

  const checkContent = (elem: HTMLDivElement) => {
    const results = checkText(elem.textContent || '');

    const elementWithAlerts: IElementWithAlerts = {
      element: elem,
      alerts: results,
    };

    MessageService.sendMessage(elementWithAlerts);
  };

  return (
    <div
      ref={(ref) => {
        if (ref !== null) checkContent(ref);
      }}
      spellCheck={false}
      style={{
        appearance: 'textarea',
        whiteSpace: 'pre-wrap',
        position: 'absolute',
        visibility: 'hidden',
        top: `${element.offsetTop + element.clientTop}px`,
        left: `${element.offsetLeft + element.clientLeft}px`,
        paddingTop: style.paddingTop,
        paddingLeft: style.paddingLeft,
        width: style.width,
      }}
    >
      {element.value}
    </div>
  );
};

export default CarbonCopyTextarea;
