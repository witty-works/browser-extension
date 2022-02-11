import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement, RequestConfig, ScrollPos } from '../shared/types';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Input from './Input';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  GermanGenderEndings,
} from '../shared/constants';
import {
  setBaseURL,
  setRequestConfig,
  setAppID,
} from '../shared/ApiServices/requests';
import { isInputElement, nodeExistsInDOM } from '../shared/utils';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import WittySupportIcon from './WittySupportsIcon';

interface Iinput {
  element: CustomInputElement;
  id: number;
}

const ContentScriptApp: React.FC = () => {
  const [reqConfig, setReqConfig, reqConfigRef] = useStateRef(
    {} as RequestConfig
  );
  const [inputs, setInputs, inputsRef] = useStateRef<Iinput[]>([]);

  const doc = document.documentElement || document.body;
  const [bodyScroll, setBodyScroll] = useState<ScrollPos>({
    top: doc.scrollTop,
    left: doc.scrollLeft,
  } as ScrollPos);

  const [parentScroll, setParentScroll] = useState<ScrollPos>({
    top: 0,
    left: 0,
  } as ScrollPos);

  const [hoveredElement, setHoveredElement] =
    useState<CustomInputElement | null>(null);

  const log = useLog('ContentScriptApp');

  useEffect(() => {
    //Init API requests Config
    browser.storage.local
      .get(null)
      .then((result) => {
        //Set appID
        setAppID(result[StorageKeys.APP_ID]);

        //Set the Endpoint url
        setBaseURL(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );

        //Define API requests config
        const reqConfig: RequestConfig = {
          german_gender_ending:
            GermanGenderEndings[
              result[
                StorageKeys.GERMAN_GENDER_ENDING
              ] as keyof typeof GermanGenderEndings
            ],
          preferred_languages: result[StorageKeys.PREFERRED_LANGUAGES]
            .map((lang: string) => lang.split('-')[0])
            .join(','),
          preferred_variants: result[StorageKeys.PREFERRED_LANGUAGES].join(','),
          primary_language: result[StorageKeys.PRIMARY_LANGUAGE],
        };
        setReqConfig(reqConfig);
      })
      .catch(onBrowserStorageError);

    // const section = document.querySelector('section');
    // const newEditableDiv: HTMLDivElement = document.createElement(
    //   'DIV'
    // ) as HTMLDivElement;
    // newEditableDiv.id = 'div-editable';
    // newEditableDiv.contentEditable = 'true';
    // newEditableDiv.style.backgroundColor = 'white';
    // // newEditableDiv.style.width = '600px';
    // newEditableDiv.style.height = '150px';
    // newEditableDiv.style.padding = '10px';
    // newEditableDiv.style.overflow = 'auto';
    // if (section) section.appendChild(newEditableDiv);

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
    document.addEventListener('scroll', handleDocumentScrollEvent, true);
    window.addEventListener('resize', handleWindowResize);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('scroll', handleDocumentScrollEvent);
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  const storageChange = (changes: any) => {
    let changedItems = Object.keys(changes);

    for (let item of changedItems) {
      switch (item) {
        case StorageKeys.API_ENDPOINT_KEY:
          setBaseURL(changes[item].newValue);
          break;
        case StorageKeys.PRIMARY_LANGUAGE:
          setReqConfig({
            ...reqConfigRef.current,
            primary_language: changes[item].newValue,
          });
          break;
        case StorageKeys.PREFERRED_LANGUAGES:
          setReqConfig({
            ...reqConfigRef.current,
            preferred_languages: changes[item].newValue
              .map((lang: string) => lang.split('-')[0])
              .join(','),
            preferred_variants: changes[item].newValue.join(','),
          });
          break;
        case StorageKeys.GERMAN_GENDER_ENDING:
          setReqConfig({
            ...reqConfigRef.current,
            german_gender_ending:
              GermanGenderEndings[
                changes[item].newValue as keyof typeof GermanGenderEndings
              ],
          });
          break;
      }
    }
  };

  useEffect(() => {
    setRequestConfig(reqConfig);
  }, [reqConfig]);

  const onBrowserStorageError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const handleFocusinElement = (event: Event) => {
    const target = event.target as CustomInputElement;

    if (isInputElement(target))
      if (!inputsRef.current.some((input: Iinput) => input.element === target))
        setInputs([
          ...inputsRef.current,
          {
            element: target,
            id:
              target.getBoundingClientRect().left +
              target.getBoundingClientRect().top,
          },
        ]);
    // if (!inputsRef.current.includes(target)) {
    //   setHoveredElement(null);
    //   setInputs([...inputsRef.current, target]);
    // }
  };

  const handleMouseOver = (event: MouseEvent) => {
    const target = event.target as CustomInputElement;
    if (
      !isInputElement(target) ||
      target.tagName === 'P' ||
      inputsRef.current.length > 0
    )
      return;
    setHoveredElement(target);
  };

  const handleMouseOut = (event: MouseEvent) => {
    const target = event.target as CustomInputElement;
    if (!isInputElement(target)) return;
    setHoveredElement(null);
  };

  const handleDocumentScrollEvent = (event: Event) => {
    //TODO add throttle
    if ((event.target as HTMLElement).nodeName === '#document') {
      setBodyScroll({ top: doc.scrollTop, left: doc.scrollLeft });
    } else {
      const target = event.target as CustomInputElement;
      if (
        !document.querySelector('witty-code')?.contains(target) &&
        !!inputsRef.current.some((input: Iinput) => input.element === target)
      ) {
        setParentScroll({ top: target.scrollTop, left: target.scrollLeft });
      }
    }
  };

  const handleWindowResize = () => {
    const newInputs = inputsRef.current.map((input: Iinput) => {
      return {
        element: input.element,
        id:
          input.element.getBoundingClientRect().left +
          input.element.getBoundingClientRect().top,
      };
    });
    setInputs(newInputs);
  };

  useEffect(() => {
    log(`Analyzed inputs:`, logTypes.INFO, inputs.length > 0 ? inputs : 'None');
  }, [inputs]);

  //Check if tracked inputs are still visible
  //If not, remove it from the list of inputs.
  //That way the highlights are also removed
  const mutationObserver = new MutationObserver(() => {
    inputsRef.current.forEach((input: Iinput) => {
      if (!nodeExistsInDOM(input.element))
        setInputs([
          ...inputsRef.current.filter(
            (filterInput: Iinput) => filterInput.element !== input.element
          ),
        ]);
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  return (
    <>
      {hoveredElement && (
        <WittySupportIcon active={false} elementReference={hoveredElement} />
      )}
      {inputs.map((input: Iinput) => (
        <Input
          //Inputs need to be updated when they are resized, which is done on the window resize listener.
          //By binding the key to a calculation of the input position properties, we assure that react re-renders
          //the inputs when their positions change.
          key={input.id}
          element={input.element}
          bodyScroll={bodyScroll}
          parentScroll={parentScroll}
        />
      ))}
    </>
  );
};

export default ContentScriptApp;
