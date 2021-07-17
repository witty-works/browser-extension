import React from 'react';
import { IAlert } from '../types';

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

  const checkContent = (elem: HTMLElement) => {
    console.log('elem = ', elem);

    const results = checkText(elem.textContent || '');
    console.log('results = ', results);
  };

  return (
    <div>
      <div
        // contentEditable={true}
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
        }}
      >
        {element.value}
      </div>
    </div>
  );
};

export default CarbonCopyTextarea;
