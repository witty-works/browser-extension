import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement } from '../shared/types';
import Input, { InputProps } from './Input';
import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import useStateRef from '../shared/customHooks/useStateRef';
import { DEV_ENV } from '../shared/constants';
import { isInputElement } from '../shared/utils';

const ContentScriptApp: React.FC = () => {
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');
  const [inputs, setInputs, inputsRef] = useStateRef([] as InputProps[]);

  useEffect(() => {
    //Define the Endpoint
    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setUrlEndpointKey(result[StorageKeys.API_ENDPOINT_KEY]);
        else setUrlEndpointKey(DefaultBaseUrlKey);
      })
      .catch(onBrowserStorageError);

    const section = document.querySelector('section');
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

    //TEMPORAL, create an extra textarea
    // const newTextarea: HTMLTextAreaElement = document.createElement(
    //   'TEXTAREA'
    // ) as HTMLTextAreaElement;
    // newTextarea.id = 'editor-copy';
    // newTextarea.cols = 25;
    // newTextarea.rows = 25;
    // if (section) section.appendChild(newTextarea);

    //Capture all the scrolling events, including window scrolling
    browser.storage.onChanged.addListener(storageChange);
    document.addEventListener('focusin', handleFocusinElement, true);
    // document.addEventListener('input', handleInputElement);

    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      // document.removeEventListener('input', handleInputElement);
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

  const getInputElementIndexPos = (element: CustomInputElement): number => {
    return inputsRef.current.findIndex(
      (input: InputProps) =>
        input.element &&
        isInputElement(input.element) &&
        input.element === element
    );
  };

  useEffect(() => {
    if (urlEndpointKey.localeCompare('') !== 0) {
      setBaseURL(urlEndpointKey);
    }
  }, [urlEndpointKey]);

  const onBrowserStorageError = (error: string) => {
    if (DEV_ENV) console.log('onBrowserStorage Error = ', error);
  };

  const handleFocusinElement = (event: Event) => {
    const target = event.target as CustomInputElement;

    //Ignore anything that is not a TextArea or a contentEditable element
    if (isInputElement(target)) {
      // setFocusedInput(target);
      const index = getInputElementIndexPos(target);

      if (index === -1) {
        const newInput: InputProps = {
          id: `${target.tagName}-${inputsRef.current.length}`,
          element: target,
        };
        setInputs([...inputsRef.current, newInput]);
      }
    }
  };

  useEffect(() => {
    console.log('ContentScriptApp INPUTS = ', inputs);
  }, [inputs]);

  return (
    <>
      {inputs.map((input: InputProps) => (
        <Input key={input.id} id={input.id} element={input.element} />
      ))}
    </>
  );
};

export default ContentScriptApp;
