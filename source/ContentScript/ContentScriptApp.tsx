import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import {
  CustomInputElement,
  // ClonableInputElement,
  Iinput,
  IAlertContentData,
} from '../shared/types';
import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import TextAreaClone from '../shared/components/TextAreaClone';
import useStateRef from '../shared/customHooks/useStateRef';
import { DEV_ENV } from '../shared/constants';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import Highlights from '../shared/components/Highlights';

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
    newEditableDiv.style.width = '400px';
    newEditableDiv.style.height = '200px';
    newEditableDiv.style.padding = '10px';
    if (section) section.appendChild(newEditableDiv);

    //Capture all the scrolling events, including window scrolling
    browser.storage.onChanged.addListener(storageChange);
    document.addEventListener('focusin', handleFocusinElement, true);
    document.addEventListener('input', handleInputElement);

    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('input', handleInputElement);
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

  const findInputElement = (element: CustomInputElement): number => {
    // console.log(
    //   'element instanceof HTMLTextAreaElement = ',
    //   element instanceof HTMLTextAreaElement
    // );

    return inputsRef.current.findIndex((input: Iinput) =>
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement
        ? input.inputElement &&
          isInputElement(input.inputElement) &&
          input.inputElement === element
        : input.divElement === element
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
    // setFocusedInput(target);

    const index = findInputElement(target);
    console.log('-----> handleFocusinElement index = ', index);

    if (index === -1) {
      const newInput: Iinput = (
        target.tagName === 'DIV'
          ? {
              divElement: target,
              inputElement: null,
              alerts: [],
            }
          : {
              divElement: {} as HTMLDivElement,
              inputElement: target,
              alerts: [],
            }
      ) as Iinput;

      setInputs([...(inputsRef.current as Iinput[]), newInput]); //TODO needed?
    }
  };

  const handleInputElement = (event: Event) => {
    const target = event.target as CustomInputElement;
    // console.log('handleInputElement target = ', target);
    setFocusedInput(target);

    const index: number = findInputElement(target);
    // console.log('handleInputElement index = ', index);

    //TODO checking type of input it's too much repeated...
    target.tagName === 'DIV'
      ? (inputsRef.current[index].divElement = target)
      : (inputsRef.current[index].inputElement = target);

    setInputs([...(inputsRef.current as Iinput[])]); //TODO I think it's not needed

    //Check for whitespaces and remove them
    let text =
      (target.tagName === 'DIV'
        ? target.textContent
        : (target as HTMLTextAreaElement).value) || '';
    const detectWhiteSpace = text.match(/^\s+$/);
    if (detectWhiteSpace) text = '';
    console.log('text = ', text);
    sendText(text);
  };

  const updateCloneData = (
    textAreaElement: HTMLTextAreaElement,
    divElement: HTMLDivElement
  ) => {
    // console.log('divElement = ', divElement);

    const index: number = findInputElement(textAreaElement);
    (inputsRef.current[index] as Iinput).divElement = divElement;
    // console.log('updateCloneData index = ', index);

    // console.log('divElement textContent = ', divElement.textContent);
  };

  useEffect(() => {
    console.log('INPUTS = ', inputs);
  }, [inputs]);

  useEffect(() => {
    console.log('checkEndpointResponse = ', checkEndpointResponse);
    console.log('focusedInput = ', focusedInput);

    const index: number = findInputElement(focusedInput);
    console.log('checkEndpointResponse index = ', index);
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
      {inputs
        .filter((input: Iinput) => input.inputElement?.tagName === 'TEXTAREA')
        .map((input: Iinput, index: number) => (
          <TextAreaClone
            key={index}
            element={input.inputElement as HTMLTextAreaElement}
            updateClone={updateCloneData}
          />
        ))}
      {inputs.map((input: Iinput, index: number) => (
        <Highlights
          key={index}
          divElement={input.divElement}
          inputElement={input.inputElement}
          alerts={input.alerts}
        />
      ))}
    </>
  );
};

export default ContentScriptApp;
