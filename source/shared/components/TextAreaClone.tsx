import React, { useEffect, useCallback, useRef, useState } from 'react';
import { IAlert, IElementWithAlerts } from '../types';

import useEndpoint from '../ApiServices/useEndpoint';
import useMutationObservable from '../customHooks/useMutationObservable';
import { MessageService } from '../MessageService';

export interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
}: TextAreaCloneProps) => {
  const [analyzedText, analyzedTextError, sendText] = useEndpoint();
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const [alerts, setAlerts] = useState<IAlert[]>([]);

  const elementStyle = window.getComputedStyle(element);
  const elementBoundingClientRect = element.getBoundingClientRect();

  let timer: any; // TODO Use a proper Debouncer

  const onElementMutation = useCallback(
    (mutation) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        //MutationObserver Detects when there is no text in Textarea (childList = 0),
        //so it can trigger its callback before alerts its updated.
        //That's why we do this check and setAlerts to an empty array
        mutation[0].target.textContent.localeCompare('') === 0
          ? setAlerts([])
          : sendAlerts(alerts, mutation[0].target);
      }, 10);
    },
    [alerts, timer]
  );

  useMutationObservable(cloneRef.current as HTMLDivElement, onElementMutation);

  useEffect(() => {
    const alerts: IAlert[] = analyzedText.results.map((result: any) => {
      return {
        id: `${result.category}-${result.text}-${result.start}-${result.end}`,
        startOffset: result.start,
        endOffset: result.end,
        data: {
          category: result.category,
          text: result.text,
          label: result.label,
          reason: result.reason,
          solution: result.solution,
        },
      };
    });

    setAlerts(alerts);
  }, [analyzedText]);

  useEffect(() => {
    sendAlerts(alerts, cloneRef.current);
  }, [alerts]);

  const sendAlerts = (
    alerts: IAlert[],
    cloneElement: HTMLDivElement | null
  ) => {
    const elementWithAlerts: IElementWithAlerts = {
      originalElement: element,
      cloneElement,
      alerts,
    };

    MessageService.sendMessage(elementWithAlerts);
  };

  useEffect(() => {
    if (analyzedTextError.detail && analyzedTextError.detail.length > 0) {
      // Error!
      console.log('ERROR! = ', analyzedTextError);
    }
  }, [analyzedTextError]);

  const checkContent = (elem: HTMLDivElement) => {
    sendText(elem.textContent || '');
  };

  return (
    <div
      ref={(ref) => {
        if (ref !== null) {
          cloneRef.current = ref as HTMLDivElement;
          checkContent(ref);
        }
      }}
      spellCheck={false}
      style={{
        appearance: 'textarea',
        whiteSpace: 'pre-wrap',
        position: 'fixed',
        visibility: 'hidden',
        // zIndex: -1,
        // outline: '3px solid red',
        overflow: 'auto',
        top: `${elementBoundingClientRect.top - element.scrollTop}px`, //TODO would work define scrollTop property and not substract it here?
        left: `${elementBoundingClientRect.left - element.scrollLeft}px`,
        paddingTop: elementStyle.paddingTop,
        paddingLeft: elementStyle.paddingLeft,
        width: elementStyle.width,
        height: elementStyle.height,
      }}
    >
      {element.value}
    </div>
  );
};

export default TextAreaClone;
