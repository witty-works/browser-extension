import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import {
  CustomInputElement,
  // ClonableInputElement,
  Iinput,
} from '../shared/types';
import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import TextAreaClone from '../shared/components/TextAreaClone';
import useStateRef from '../shared/customHooks/useStateRef';
import { DEV_ENV } from '../shared/constants';

const ContentScriptApp: React.FC = () => {
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');
  // const [inputs, setInputs] = useState<Iinput[]>([]);
  // const inputs = useRef<Iinput[]>([]);
  const [inputs, setInputs, inputsRef] = useStateRef([]);
  // const [focusedInput, setFocusedInput] = useState<CustomInputElement>(
  //   {} as CustomInputElement
  // );

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
    const target = event.target as HTMLTextAreaElement; //TODO Cover other types of inputs
    // setFocusedInput(target);

    const index = findInputElement(target);
    console.log('-----> handleFocusinElement index = ', index);

    if (index === -1) {
      setInputs([
        ...inputsRef.current,
        {
          divElement: {} as HTMLDivElement,
          inputElement: target,
          alerts: [],
        },
      ]);
    }
  };

  const handleInputElement = (event: Event) => {
    const target = event.target as HTMLTextAreaElement; //TODO Cover other types of inputs
    // console.log('handleInputElement target = ', target);

    const index: number = findInputElement(target);
    // console.log('handleInputElement index = ', index);

    inputsRef.current[index].inputElement = target;
    setInputs([...inputsRef.current]);
  };

  const updateCloneData = (
    textAreaElement: HTMLTextAreaElement,
    divElement: HTMLDivElement
  ) => {
    // console.log('divElement = ', divElement);

    const index: number = findInputElement(textAreaElement);
    inputsRef.current[index].divElement = divElement;
    // console.log('updateCloneData index = ', index);

    // console.log('divElement textContent = ', divElement.textContent);
  };

  useEffect(() => {
    console.log('INPUTS = ', inputs);
  }, [inputs]);

  return (
    <>
      {inputs.map((input: Iinput, index: number) => (
        <TextAreaClone
          key={index}
          element={input.inputElement as HTMLTextAreaElement}
          updateClone={updateCloneData}
        />
      ))}
    </>
  );
};

export default ContentScriptApp;
