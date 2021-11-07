import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement } from '../shared/types';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Input from './Input';
import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import { DEV_ENV } from '../shared/constants';
import { isInputElement, elementExistsinDOM } from '../shared/utils';

const ContentScriptApp: React.FC = () => {
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');
  // const [inputs, setInputs] = useState<CustomInputElement[]>([]);
  const [inputs, setInputs, inputsRef] = useStateRef(
    [] as CustomInputElement[]
  );

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
    // newEditableDiv.style.width = '600px';
    newEditableDiv.style.height = '150px';
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

    browser.storage.onChanged.addListener(storageChange);
    document.addEventListener('focusin', handleFocusinElement, true);

    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
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
    if (isInputElement(target))
      if (!inputsRef.current.includes(target))
        setInputs([...inputsRef.current, target]);
  };

  useEffect(() => {
    console.log('ContentScriptApp INPUTS = ', inputs);
  }, [inputs]);

  //Check if tracked inputs are still visible
  //If not, remove it from the list of inputs.
  //That way the highlights are also removed
  const mutationObserver = new MutationObserver(() => {
    inputsRef.current.forEach((input: CustomInputElement) => {
      if (!elementExistsinDOM(input))
        setInputs([
          ...inputsRef.current.filter(
            (filterInput: CustomInputElement) => filterInput !== input
          ),
        ]);
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  return (
    <>
      {inputs.map((input: CustomInputElement, index: number) => (
        <Input key={index} element={input} />
      ))}
    </>
  );
};

export default ContentScriptApp;
