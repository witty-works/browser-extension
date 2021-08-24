import React, { useEffect, useCallback, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import TextAreaClone from '../shared/components/TextAreaClone';
import Highlights from '../shared/components/Highlights';
import { CustomInputElement } from '../shared/types';
import useStateRef from '../shared/customHooks/useStateRef';

const ContentScriptApp: React.FC = () => {
  const [inputs, setInputs, inputsRef] = useStateRef([]);
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');

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

    //Capture all the scrolling events, including window scrolling
    window.addEventListener('scroll', handleScrollElement, true);
    document.addEventListener('input', handleInputElement);
    browser.storage.onChanged.addListener(storageChange);

    return () => {
      //Don't forget to remove the listeners at the end
      window.removeEventListener('scroll', handleScrollElement);
      document.removeEventListener('input', handleInputElement);
      browser.storage.onChanged.removeListener(storageChange);
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
      const inputs = getAllInputElements(); //TODO Needs forcing a rerender
      setInputs(inputs);
    }
  }, [urlEndpointKey]);

  const onError = (error: string) => {
    console.log('onError = ', error);
  };

  const getAllInputElements = (): CustomInputElement[] => {
    //Detect all Inputs
    return Array.from(
      document.querySelectorAll(`
      input[type=text],
      textarea,
      div[contenteditable=true]
    `)
    ).map((input, index) => {
      input.setAttribute('data-id', `${input.tagName}-${index}`); //Set an ID to each of them, to recognize them later
      return input;
    });
  };

  const findInputElement = (
    inputs: CustomInputElement[],
    element: HTMLElement
  ): number => {
    return inputs.findIndex(
      (input: CustomInputElement) =>
        input.getAttribute('data-id') === element.getAttribute('data-id')
    );
  };

  const handleInputElement = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;
      const index = findInputElement(inputsRef.current, target);
      inputsRef.current[index] = target;
      setInputs([...inputsRef.current]);
    },
    [inputsRef, setInputs]
  );

  const handleScrollElement = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;

      if (target.nodeName.localeCompare('#document') === 0) {
        //User is scrolling the whole page, update all the input elements
        setInputs([...getAllInputElements()]);
      } else {
        //User is scrolling a specific component, we just update this one
        const index = findInputElement(inputsRef.current, target);
        inputsRef.current[index] = target;
        setInputs([...inputsRef.current]);
      }
    },
    [inputsRef, setInputs]
  );

  return (
    <div>
      {/* {elem === undefined ? null : <TextAreaClone element={elem.element} />} */}
      {inputs
        .filter((input: CustomInputElement) => input.tagName === 'TEXTAREA')
        .map((textarea: HTMLTextAreaElement, index: number) => (
          <TextAreaClone key={index} element={textarea} />
        ))}
      <Highlights />
    </div>
  );
};

export default ContentScriptApp;
