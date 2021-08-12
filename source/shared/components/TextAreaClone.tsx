import React, { useEffect, useCallback, useRef, useState } from 'react';
import { IAlert, IElementWithAlerts } from '../types';

import useEntities from '../ApiServices/useEntities';
import useMutationObservable from '../customHooks/useMutationObservable';
import { MessageService } from '../MessageService';

export interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
}: TextAreaCloneProps) => {
  const [entities, error, sendText] = useEntities();
  const cloneRef = useRef<HTMLDivElement | null>(null);
  // const [cloneElement, setCloneElement] = useState<HTMLDivElement | null>(null);
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [elementRect, setElementRect] = useState<DOMRect>(
    element.getBoundingClientRect()
  );

  const style = window.getComputedStyle(element);
  console.log('*** elementRec 1 = ', element.getBoundingClientRect());

  useEffect(() => {
    console.log('*** elementRec 2 = ', elementRect);
  }, []);

  useEffect(() => {
    console.log('*** elementRec 3 = ', elementRect);
  }, [elementRect]);

  // let cloneElement: HTMLDivElement | null = null;
  let timer: any; // TODO Use a proper Debouncer

  const onListMutation = useCallback(
    (mutationList) => {
      // console.log('mutationList = ', mutationList);
      // console.log('mutationList[0].target = ', mutationList[0].target);
      // console.log(
      //   'mutationList[0].target style top = ',
      //   mutationList[0].target.style.top
      // );

      // console.log('aaaaaaaalerts = ', alerts);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        sendAlerts(alerts, mutationList[0].target);
      }, 10);
    },
    [alerts, timer]
  );

  useMutationObservable(cloneRef.current as HTMLDivElement, onListMutation);

  useEffect(() => {
    // console.log('ENTITIES! = ', entities.entities);
    // console.log(JSON.stringify(entities.entities));

    const alerts: IAlert[] = entities.entities.map((entity: any) => {
      return {
        id: `${entity.type}-${entity.text}-${entity.start}-${entity.end}`,
        startOffset: entity.start,
        endOffset: entity.end,
      };
    });

    setAlerts(alerts);

    // const elementWithAlerts: IElementWithAlerts = {
    //   // cloneElement,
    //   // originalElement: element,
    //   element: cloneRef.current,
    //   alerts,
    // };

    // MessageService.sendMessage(elementWithAlerts);
  }, [entities]);

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
    if (error.detail && error.detail.length > 0) {
      // Error!
      console.log('ERROR! = ', error);
    }
  }, [error]);

  const checkContent = (elem: HTMLDivElement) => {
    // cloneElement = elem;
    // setCloneElement(elem.cloneNode(true));
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
        position: 'absolute',
        // visibility: 'hidden',
        zIndex: -1,
        outline: '3px solid red',
        overflow: 'auto',
        top: `${element.offsetTop + element.clientTop - element.scrollTop}px`, //TODO would work define scrollTop property and not substract it here?
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
