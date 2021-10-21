import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement, Iinput, IAlertContentData } from '../shared/types';
import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import TextAreaClone from './TextAreaClone';
import DivClone from './DivClone';
import useStateRef from '../shared/customHooks/useStateRef';
import { DEV_ENV } from '../shared/constants';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import Highlights from '../shared/components/Highlights';
import HighlightsLoader from './HighlightsLoader';
import { convertHTMLToText } from '../shared/utils';

const ContentScriptApp: React.FC = () => {
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');
  const [inputs, setInputs, inputsRef] = useStateRef([] as Iinput[]);
  const [focusedInput, setFocusedInput] = useState<CustomInputElement>(
    {} as CustomInputElement
  );
  const [loading, checkEndpointResponse, checkEndpointError, sendText] =
    useCheckEndpoint();

  useEffect(() => {
    //Define the Endpoint
    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setUrlEndpointKey(result[StorageKeys.API_ENDPOINT_KEY]);
        else setUrlEndpointKey(DefaultBaseUrlKey);
      })
      .catch(onError);

    //TEMPORAL, create an extra textarea
    const section = document.querySelector('section');
    const newTextarea: HTMLTextAreaElement = document.createElement(
      'TEXTAREA'
    ) as HTMLTextAreaElement;
    newTextarea.id = 'editor-copy';
    newTextarea.cols = 25;
    newTextarea.rows = 25;
    if (section) section.appendChild(newTextarea);

    const newEditableDiv: HTMLDivElement = document.createElement(
      'DIV'
    ) as HTMLDivElement;
    newEditableDiv.id = 'div-editable';
    newEditableDiv.contentEditable = 'true';
    newEditableDiv.style.backgroundColor = 'white';
    newEditableDiv.style.width = '600px';
    newEditableDiv.style.height = '300px';
    newEditableDiv.style.padding = '10px';
    newEditableDiv.style.overflow = 'auto';
    if (section) section.appendChild(newEditableDiv);

    //Capture all the scrolling events, including window scrolling
    browser.storage.onChanged.addListener(storageChange);
    document.addEventListener('focusin', handleFocusinElement, true);
    document.addEventListener('input', handleInputElement);
    window.addEventListener('scroll', handleScrollElement, true);

    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('input', handleInputElement);
      window.removeEventListener('scroll', handleScrollElement);
    };
  }, []);

  const storageChange = (changes: any) => {
    let changedItems = Object.keys(changes);

    for (let item of changedItems) {
      switch (item) {
        case StorageKeys.API_ENDPOINT_KEY:
          setUrlEndpointKey(changes[item].newValue);
          break;
      }
    }
  };

  const isInputElement = (element: CustomInputElement) => {
    return (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLDivElement
    );
  };

  const getInputElementIndexPos = (element: CustomInputElement): number => {
    return inputsRef.current.findIndex(
      (input: Iinput) =>
        input.inputElement &&
        isInputElement(input.inputElement) &&
        input.inputElement === element
    );
  };

  useEffect(() => {
    if (urlEndpointKey.localeCompare('') !== 0) {
      setBaseURL(urlEndpointKey);
    }
  }, [urlEndpointKey]);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('onError = ', error);
  };

  const handleFocusinElement = (event: Event) => {
    const target = event.target as CustomInputElement;
    const index = getInputElementIndexPos(target);

    if (index === -1) {
      const newInput: Iinput = {
        cloneElement: {} as HTMLDivElement,
        inputElement: target,
        alerts: [],
      } as Iinput;

      setInputs([...(inputsRef.current as Iinput[]), newInput]); //TODO needed?
    }
  };

  const updateInputElement = (element: CustomInputElement): void => {
    const index: number = getInputElementIndexPos(element);

    //TODO checking type of input it's too much repeated...
    if (index !== -1) {
      inputsRef.current[index].inputElement = element;

      setInputs([...(inputsRef.current as Iinput[])]);
    }
  };

  const handleInputElement = (event: Event) => {
    const target = event.target as CustomInputElement;
    setFocusedInput(target);

    updateInputElement(target);

    //Check for whitespaces and remove them
    let text =
      (target.tagName === 'DIV'
        ? convertHTMLToText(target.innerHTML)
        : (target as HTMLTextAreaElement).value) || '';
    // const detectWhiteSpace = text.match(/^\s+$/);
    // if (detectWhiteSpace) text = '';
    sendText(text);
  };

  const handleScrollElement = (event: Event) => {
    const target = event.target as CustomInputElement;

    if (target.nodeName.localeCompare('#document') === 0) {
      //User is scrolling the whole page, update all the input elements
      const elements = Array.from(
        document.querySelectorAll(`
          textarea,
          div[contenteditable=true]
        `)
      ) as HTMLElement[];

      elements.forEach((element: HTMLElement) =>
        updateInputElement(element as CustomInputElement)
      );
    } else {
      //User is scrolling a specific component, we just update this one
      updateInputElement(target as CustomInputElement);
    }
  };

  const updateTextAreaCloneData = (
    textAreaElement: HTMLTextAreaElement,
    divElement: HTMLDivElement
  ) => {
    const index: number = getInputElementIndexPos(textAreaElement);
    (inputsRef.current[index] as Iinput).cloneElement = divElement;
  };

  const updateDivCloneData = (
    originalElement: HTMLDivElement,
    divElement: HTMLDivElement
  ) => {
    const index: number = getInputElementIndexPos(originalElement);
    (inputsRef.current[index] as Iinput).cloneElement = divElement;
  };

  useEffect(() => {
    console.log('INPUTS = ', inputs);
  }, [inputs]);

  useEffect(() => {
    const index: number = getInputElementIndexPos(focusedInput);
    if (index !== -1)
      (inputsRef.current[index] as Iinput).alerts =
        checkEndpointResponse.results.map((result: any) => ({
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
        }));
  }, [checkEndpointResponse]);

  useEffect(() => {
    if (checkEndpointError.detail && checkEndpointError.detail.length > 0) {
      // Error!
      if (DEV_ENV) console.log('API Error = ', checkEndpointError);
    }
  }, [checkEndpointError]);

  return (
    <>
      {inputs.map((input: Iinput, index: number) =>
        input.inputElement?.tagName === 'TEXTAREA' ? (
          <TextAreaClone
            key={index}
            element={input.inputElement as HTMLTextAreaElement}
            updateClone={updateTextAreaCloneData}
          />
        ) : (
          <DivClone
            key={index}
            element={input.inputElement as HTMLDivElement}
            updateClone={updateDivCloneData}
          />
        )
      )}
      {inputs.map((input: Iinput, index: number) => {
        return (
          <Highlights
            key={index}
            cloneElement={input.cloneElement}
            inputElement={input.inputElement}
            alerts={input.alerts}
          />
        );
      })}
      {loading ? <HighlightsLoader elementReference={focusedInput} /> : null}
    </>
  );
};

export default ContentScriptApp;
