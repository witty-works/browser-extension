import React, { useState, useEffect } from 'react';

import TextAreaClone from './TextAreaClone';
import Highlights from './Highlights';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { DEV_ENV } from '../shared/constants';
import { CustomInputElement, IAlert, IAlertContentData } from '../shared/types';

export interface InputProps {
  id: string;
  element: CustomInputElement;
}

const Input: React.FC<InputProps> = ({ element }: InputProps) => {
  const [loading, checkEndpointResponse, checkEndpointError, sendText] =
    useCheckEndpoint();
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [clone, setClone] = useState<HTMLDivElement>();

  console.log('====================================== ');

  useEffect(() => {
    element.addEventListener('input', handleInputElement);
    return () => {
      //Don't forget to remove the listeners at the end
      element.removeEventListener('input', handleInputElement);
    };
  }, []);

  const handleInputElement = (event: Event) => {
    const target = event.target as CustomInputElement;
    const text: string =
      target instanceof HTMLTextAreaElement ? target.value : target.innerText;

    console.log('INPUT handleInputElement text = ', text);
    sendText(text);
  };

  // useEffect(() => {
  //   console.log('INPUT useEffect element = ', element);
  // }, [element]);

  useEffect(() => {
    if (checkEndpointResponse) {
      const alerts: IAlert[] = checkEndpointResponse.results.map(
        (result: any) => ({
          //TODO specify this type
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
          element={
            (element instanceof HTMLTextAreaElement
              ? clone
              : element) as HTMLDivElement
          }
          alerts={alerts}
        />
      ) : null}
    </div>
  );
};

export default Input;
