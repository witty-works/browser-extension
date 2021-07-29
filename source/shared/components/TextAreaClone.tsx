import React from 'react';
import { IAlert, IElementWithAlerts } from '../types';

import useEntities from '../ApiServices/useEntities';
import { MessageService } from '../MessageService';

export interface TextAreaCloneProps {
  element: HTMLTextAreaElement | HTMLInputElement;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
}: TextAreaCloneProps) => {
  const [entities, error, sendText] = useEntities();

  const style = window.getComputedStyle(element);

  const checkContent = (elem: HTMLDivElement) => {
    sendText(elem.textContent || '');

    if (error.detail && error.detail.length > 0) {
      // Error!
      console.log('ERROR! = ', error);
    } else {
      const alerts: IAlert[] = entities.entities.map((entity: any) => {
        return {
          id: `${entity.type}-${entity.text}-${entity.start}-${entity.end}`,
          startOffset: entity.start,
          endOffset: entity.end,
        };
      });

      const elementWithAlerts: IElementWithAlerts = {
        cloneElement: elem,
        originalElement: element,
        alerts,
      };

      MessageService.sendMessage(elementWithAlerts);
    }
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
        overflow: 'auto',
        top: `${element.offsetTop + element.clientTop - element.scrollTop}px`,
        left: `${element.offsetLeft + element.clientLeft}px`,
        paddingTop: style.paddingTop,
        paddingLeft: style.paddingLeft,
        width: style.width,
        height: style.height,
      }}
    >
      {element.value}
    </div>
  );
};

export default TextAreaClone;
