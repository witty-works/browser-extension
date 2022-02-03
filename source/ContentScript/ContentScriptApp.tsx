import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import {
  CanvasPosition,
  CustomInputElement,
  RequestConfig,
  ScrollPos,
} from '../shared/types';
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
import { drawIcon } from './highlightsUtils';

const passiveWittyIcon =
  require('../assets/icons/canvas/witty-passive.svg') as string;

const ContentScriptApp: React.FC = () => {
  const [reqConfig, setReqConfig, reqConfigRef] = useStateRef(
    {} as RequestConfig
  );
  const [inputs, setInputs, inputsRef] = useStateRef(
    [] as CustomInputElement[]
  );

  const doc = document.documentElement || document.body;
  const [bodyScroll, setBodyScroll] = useState<ScrollPos>({
    top: doc.scrollTop,
    left: doc.scrollLeft,
  } as ScrollPos);

  const [parentScroll, setParentScroll] = useState<ScrollPos>({
    top: 0,
    left: 0,
  } as ScrollPos);

  const [canvasPosition, setCanvasPosition] = useState<CanvasPosition>({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  } as CanvasPosition);

  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('scroll', handleDocumentScrollEvent);
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
      if (!inputsRef.current.includes(target)) {
        setCanvasPosition({
          top: 0,
          left: 0,
          width: 0,
          height: 0,
        });
        setInputs([...inputsRef.current, target]);
      }
  };

  const handleMouseOver = (event: MouseEvent) => {
    const target = event.target as CustomInputElement;
    if (
      !isInputElement(target) ||
      target.tagName === 'P' ||
      inputsRef.current.length > 0
    )
      return;
    const { width, height, top, left } = target.getBoundingClientRect();
    setCanvasPosition({
      top: doc.scrollTop + top,
      left: doc.scrollLeft + left,
      width: width,
      height: height,
    });
  };

  const handleMouseOut = (event: MouseEvent) => {
    const target = event.target as CustomInputElement;
    if (!isInputElement(target)) return;
    setCanvasPosition({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawIcon(context, passiveWittyIcon, canvasPosition as DOMRect, 'passive');
  }, [canvasPosition]);

  const handleDocumentScrollEvent = (event: Event) => {
    //TODO add throttle
    if ((event.target as HTMLElement).nodeName === '#document') {
      setBodyScroll({ top: doc.scrollTop, left: doc.scrollLeft });
    } else {
      const target = event.target as CustomInputElement;
      if (
        !document.querySelector('witty-code')?.contains(target) &&
        !inputsRef.current.includes(target)
      ) {
        setParentScroll({ top: target.scrollTop, left: target.scrollLeft });
      }
    }
  };

  useEffect(() => {
    log(`Analyzed inputs:`, logTypes.INFO, inputs.length > 0 ? inputs : 'None');
  }, [inputs]);

  //Check if tracked inputs are still visible
  //If not, remove it from the list of inputs.
  //That way the highlights are also removed
  const mutationObserver = new MutationObserver(() => {
    inputsRef.current.forEach((input: CustomInputElement) => {
      if (!nodeExistsInDOM(input))
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
      <canvas
        ref={canvasRef}
        style={
          {
            position: 'absolute',
            overflow: 'auto',
            left: `${canvasPosition.left}px`,
            top: `${canvasPosition.top}px`,
            zIndex: 99999999,
            pointerEvents: 'none',
          } as React.CSSProperties
        }
        width={canvasPosition.width}
        height={canvasPosition.height}
      />
      {inputs.map((input: CustomInputElement, index: number) => (
        <Input
          key={index}
          element={input}
          bodyScroll={bodyScroll}
          parentScroll={parentScroll}
        />
      ))}
    </>
  );
};

export default ContentScriptApp;
