import React, { useState, useEffect } from 'react';

import TextAreaClone from './TextAreaClone';
import Highlights from './Highlights';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { DEV_ENV } from '../shared/constants';
import { CustomInputElement, IAlert, IAlertContentData } from '../shared/types';
import { fixLineBreaks } from '../shared/utils';

const Input: React.FC<{ element: CustomInputElement }> = ({ element }) => {
  const [loading, checkEndpointResponse, checkEndpointError, sendText] =
    useCheckEndpoint();
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [clone, setClone] = useState<HTMLDivElement>();
  const [elementRect, setElementRect] = useState<DOMRect>({} as DOMRect);

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The turn around (at least for the moment) is to use 'keyup'
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('scroll', handleScrollEvent);
    return () => {
      //Don't forget to remove the listeners at the end
      element.removeEventListener('keyup', handleKeyupEvent);
      element.removeEventListener('scroll', handleScrollEvent);
    };
  }, []);

  useEffect(() => {
    console.log('input element = ', element);
    console.log(
      'input element.getBoundingClientRect() = ',
      element.getBoundingClientRect()
    );

    setElementRect(element.getBoundingClientRect());
  }, [element]);

  const handleKeyupEvent = (event: Event) => {
    const target = event.target as CustomInputElement;
    const text: string =
      target instanceof HTMLTextAreaElement
        ? target.value
        : fixLineBreaks(target.innerText);

    sendText(text);
  };

  const handleScrollEvent = (event: Event) => {
    const target = event.target as CustomInputElement;
    console.log('Input scroll event target = ', target);

    setElementRect(target.getBoundingClientRect());
  };

  // useEffect(() => {
  //   console.log('INPUT useEffect element = ', element);
  // }, [element]);

  useEffect(() => {
    if (checkEndpointResponse) {
      const alerts: IAlert[] = checkEndpointResponse.results.map(
        (result: any) => ({
          //TODO specify this 'any' type on the line before
          id: `${result.category}-${result.text}-${result.start}-${result.end}`,
          startOffset: result.start,
          endOffset: result.end,
          data: {
            category: result.category,
            text: result.text,
            label: result.label,
            reason: result.reason,
            solution: result.solution,
            alternatives: result.alternatives,
          } as IAlertContentData,
        })
      );
      setAlerts(alerts);
    }

    // const index: number = getInputElementIndexPos(focusedInput);
    // if (index !== -1)
    //   (inputsRef.current[index] as Iinput).alerts =
    //     checkEndpointResponse.results.map((result: any) => ({
    //       id: `${result.category}-${result.text}-${result.start}-${result.end}`,
    //       startOffset: result.start,
    //       endOffset: result.end,
    //       data: {
    //         category: result.category,
    //         text: result.text,
    //         label: result.label,
    //         reason: result.reason,
    //         solution: result.solution,
    //         alternatives: result.alternatives,
    //       } as IAlertContentData,
    //     }));
  }, [checkEndpointResponse]);

  useEffect(() => {
    if (checkEndpointError.detail && checkEndpointError.detail.length > 0) {
      // Error!
      if (DEV_ENV) console.log('API Error = ', checkEndpointError);
      if (checkEndpointError.detail === 'Language could not be determined')
        setAlerts([]);
    }
  }, [checkEndpointError]);

  const updateTextAreaCloneData = (clone: HTMLDivElement) => {
    setClone(clone);
  };

  return (
    <div className='canvas-container'>
      {element instanceof HTMLTextAreaElement ? (
        <TextAreaClone
          element={element}
          updateClone={updateTextAreaCloneData}
        />
      ) : null}
      {loading ? <HighlightsLoader elementReference={element} /> : null}
      {alerts.length > 0 ? (
        <Highlights
          // element={
          //   (element instanceof HTMLTextAreaElement
          //     ? clone
          //     : element) as HTMLDivElement
          // }
          elementChildNodes={
            (
              (element instanceof HTMLTextAreaElement
                ? clone
                : element) as HTMLDivElement
            ).childNodes
          }
          elementRect={elementRect}
          alerts={alerts}
        />
      ) : null}
    </div>
  );
};

export default Input;
