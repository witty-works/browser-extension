import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';

import {
  CustomInputElement,
  RequestConfig /* , ScrollPos  */,
} from '../shared/types';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Input from './Input';
import {
  WTags,
  StorageKeys,
  DefaultBaseUrlKey,
  GermanGenderEndings,
} from '../shared/constants';
import {
  setBaseUrls,
  setRequestConfig,
  setAppID,
  setToken,
} from '../shared/ApiServices/requests';
import {
  isInputElement,
  nodeExistsInDOM,
  elementIsVisible,
} from '../shared/utils';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';

//Witty containers' styling
const WW_CONTAINER_STYLE = `z-index: auto !important;float: left !important;display: inline !important;
width: 0px !important;height: 0px !important; top: 0px !important;left: 0px !important;
position: relative !important;visibility: visible !important;overflow: visible !important;`;

const ContentScriptApp: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [reqConfig, setReqConfig, reqConfigRef] = useStateRef(
    {} as RequestConfig
  );
  const [inputs, setInputs, inputsRef] = useStateRef(
    [] as CustomInputElement[]
  );
  // const doc = document.documentElement || document.body;
  // const [bodyScroll, setBodyScroll] = useState<ScrollPos>({
  //   top: doc.scrollTop,
  //   left: doc.scrollLeft,
  // } as ScrollPos);

  // const [parentScroll, setParentScroll] = useState<ScrollPos>({
  //   top: 0,
  //   left: 0,
  // } as ScrollPos);

  const [, setHoveredElement, hoveredElementRef] =
    useStateRef<CustomInputElement | null>(null);

  const log = useLog('ContentScriptApp');

  useEffect(() => {
    //TODO check if isMounted is needed
    // let isMounted = true;

    //Init API requests Config
    browser.storage.local
      .get(null)
      .then((result) => {
        //Set appID
        setAppID(result[StorageKeys.APP_ID]);

        if (result[StorageKeys.APP_ENABLED])
          setEnabled(result[StorageKeys.APP_ENABLED]);

        //Set the Endpoint url
        setBaseURL(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );

        //Set auth token
        setToken(result[StorageKeys.ACCESS_TOKEN]);

        //Enable/disable spellchecker
        document.body.spellcheck = result[StorageKeys.ORTHOGRAPHY]
          ? (document.body.spellcheck = false) //needed here for linkedin, could be removed when we fix focusin issue
          : (document.body.spellcheck = true);

        //Define API requests config
        const reqConfig: RequestConfig = {
          // german_gender_ending: result[StorageKeys.GERMAN_GENDER_ENDING].value,
          german_gender_ending:
            GermanGenderEndings[
              result[StorageKeys.GERMAN_GENDER_ENDING]
                .value as keyof typeof GermanGenderEndings
            ],
          preferred_languages: result[
            StorageKeys.PREFERRED_LANGUAGES
          ].value.map((lang: string) => lang.split('-')[0]),
          preferred_variants: result[StorageKeys.PREFERRED_LANGUAGES].value,
          primary_language: result[StorageKeys.PRIMARY_LANGUAGE],
          disabled_categories: [
            result[StorageKeys.ORTHOGRAPHY].value === true ? '' : 'orthography',
            result[StorageKeys.INCLUSIVE].value === true ? '' : 'inclusive',
            result[StorageKeys.STYLE].value === true ? '' : 'style',
            result[StorageKeys.CASING_SITES].includes(
              window.location.hostname.replace('www.', '')
            )
              ? 'casing'
              : '',
          ].filter((category) => category !== ''),
          maximum_importance: result[StorageKeys.MAXIMUM_IMPORTANCE].value,
          singular_they: result[StorageKeys.SINGULAR_THEY].value,
          show_inspiration_alternatives:
            result[StorageKeys.SHOW_INSPIRATION_ALTERNATIVES].value,
          gendered_roles_format:
            result[StorageKeys.GENDERED_ROLES_FORMAT].value,
        };
        // if (!isMounted) return;
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
    // document.addEventListener('scroll', handleDocumentScrollEvent, true);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    return () => {
      // isMounted = false;
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      // document.removeEventListener('scroll', handleDocumentScrollEvent);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  //TODO specify changes type
  //TODO review all cases
  const storageChange = (changes: any) => {
    // TODO fix this changes: any ^
    let changedItems = Object.keys(changes);

    for (let item of changedItems) {
      switch (item) {
        case StorageKeys.APP_ENABLED:
          setEnabled(changes[item].newValue);
          break;
        case StorageKeys.API_ENDPOINT_KEY:
          setBaseUrls(changes[item].newValue);
          break;
        case StorageKeys.ACCESS_TOKEN:
          setToken(changes[item].newValue);
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
            preferred_languages: changes[item].newValue.value
              .map((lang: string) => lang.split('-')[0])
              .join(','),
          });
          break;
        case StorageKeys.PREFERRED_VARIANTS:
          setReqConfig({
            ...reqConfigRef.current,
            preferred_variants: changes[item].newValue.value.join(','),
          });
          break;
        case StorageKeys.GERMAN_GENDER_ENDING:
          setReqConfig({
            ...reqConfigRef.current,
            german_gender_ending:
              GermanGenderEndings[
                changes[item].newValue.value as keyof typeof GermanGenderEndings
              ],
          });
          break;
        case StorageKeys.ORTHOGRAPHY:
          setReqConfig({
            ...reqConfigRef.current,
            disabled_categories: changes[item].newValue.value
              ? reqConfigRef.current.disabled_categories.filter(
                  (category) => category !== 'orthography'
                )
              : [...reqConfigRef.current.disabled_categories, 'orthography'],
          });
          break;
        case StorageKeys.INCLUSIVE:
          setReqConfig({
            ...reqConfigRef.current,
            disabled_categories: changes[item].newValue.value
              ? reqConfigRef.current.disabled_categories.filter(
                  (category) => category !== 'inclusive'
                )
              : [...reqConfigRef.current.disabled_categories, 'inclusive'],
          });
          break;

        case StorageKeys.STYLE:
          setReqConfig({
            ...reqConfigRef.current,
            disabled_categories: changes[item].newValue.value
              ? reqConfigRef.current.disabled_categories.filter(
                  (category) => category !== 'style'
                )
              : [...reqConfigRef.current.disabled_categories, 'style'],
          });
          break;
        case StorageKeys.CASING_SITES:
          setReqConfig({
            ...reqConfigRef.current,
            disabled_categories: changes[item].newValue.includes(
              window.location.hostname.replace('www.', '')
            )
              ? [...reqConfigRef.current.disabled_categories, 'casing']
              : reqConfigRef.current.disabled_categories.filter(
                  (category) => category !== 'casing'
                ),
          });
          break;

        case StorageKeys.SHOW_INSPIRATION_ALTERNATIVES:
          setReqConfig({
            ...reqConfigRef.current,
            show_inspiration_alternatives: changes[item].newValue.value,
          });
          break;
        case StorageKeys.SINGULAR_THEY:
          setReqConfig({
            ...reqConfigRef.current,
            singular_they: changes[item].newValue.value,
          });
          break;
        case StorageKeys.MAXIMUM_IMPORTANCE:
          setReqConfig({
            ...reqConfigRef.current,
            maximum_importance: changes[item].newValue ? 3 : 2,
          });
          break;
        case StorageKeys.GENDERED_ROLES_FORMAT:
          setReqConfig({
            ...reqConfigRef.current,
            gendered_roles_format: changes[item].newValue.value,
          });
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

    if (isInputElement(target) && !inputsRef.current.includes(target)) {
      setHoveredElement(null);
      setInputs([...inputsRef.current, target]);
    }
  };

  const handleMouseOver = (event: MouseEvent) => {
    const target = event.target as CustomInputElement;

    //TODO FIX Avoiding a specific tag (e.g. 'P') is a temp solution that works in sites like Gmail
    //but we could find in other sites P tags as contenteditable that will be ignored with this solution.
    //TODO FIX The condition 'inputsRef.current.length > 0' is not correct because potentially we can have several input elements
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

    if (hoveredElementRef.current?.isEqualNode(target)) setHoveredElement(null);
  };

  useEffect(() => {
    if (hoveredElementRef.current) {
      const hoveredIndicatorContainer: HTMLElement = document.createElement(
        WTags.WW_MOUSEOVER_INDICATOR
      );
      hoveredIndicatorContainer.style.cssText = WW_CONTAINER_STYLE;
      hoveredElementRef.current.parentElement?.insertBefore(
        hoveredIndicatorContainer,
        hoveredElementRef.current
      );
      ReactDOM.render(
        <StateIndicatorIcon
          elementReference={hoveredElementRef.current}
          iconType={'passive'}
          isHovered={true}
        />,
        hoveredIndicatorContainer
      );
    } else {
      const indicatorElement = document.querySelector(
        WTags.WW_MOUSEOVER_INDICATOR
      );

      if (indicatorElement) {
        indicatorElement.remove();
      }
    }
  }, [hoveredElementRef.current]);

  useEffect(() => {
    if (enabled && inputs.length > 0) {
      log(
        `Analyzed inputs:`,
        logTypes.INFO,
        inputs.length > 0 ? inputs : 'None'
      );

      inputs.forEach((input: CustomInputElement) => {
        if (input.parentElement) {
          const highlightsContainer: HTMLElement = document.createElement(
            WTags.WW_CONTAINER
          );
          highlightsContainer.style.cssText = WW_CONTAINER_STYLE;
          input.parentElement.insertBefore(highlightsContainer, input);
          ReactDOM.render(
            <Input
              element={input}
              // bodyScroll={bodyScroll}
              // parentScroll={parentScroll}
            />,
            highlightsContainer
          );
        }
      });
    }
  }, [enabled, inputs]);

  // Check if tracked inputs exists or are still visible
  // If not, remove them from the list of inputs. This way the highlights are also removed
  const mutationObserver = new MutationObserver(() => {
    inputsRef.current.forEach((input: CustomInputElement) => {
      if (!nodeExistsInDOM(input) || !elementIsVisible(input))
        setInputs([
          ...inputsRef.current.filter(
            (filterInput: CustomInputElement) => filterInput !== input
          ),
        ]);
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  return <></>;
};

export default ContentScriptApp;
