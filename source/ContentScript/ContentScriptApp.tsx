import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement, RequestConfig } from '../shared/types';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Input from './Input';
import { WTags, StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
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
} from '../shared/DOMutils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';

//Witty containers' styling
const WW_CONTAINER_STYLE = `z-index: auto !important;float: left !important;display: inline !important;
width: 0px !important;height: 0px !important; top: 0px !important;left: 0px !important;
position: relative !important;visibility: visible !important;overflow: visible !important;`;

const ContentScriptApp: React.FC = () => {
  const [reqConfig, setReqConfig, reqConfigRef] = useStateRef(
    {} as RequestConfig
  );
  const [inputs, setInputs, inputsRef] = useStateRef(
    [] as CustomInputElement[]
  );

  const [, setHoveredElement, hoveredElementRef] =
    useStateRef<CustomInputElement | null>(null);

  const log = useLog('ContentScriptApp');

  useEffect(() => {
    //Init API requests Config
    browser.storage.local
      .get(null)
      .then((result) => {
        setAppID(result[StorageKeys.APP_ID]);
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        setToken(result[StorageKeys.ACCESS_TOKEN]);

        //Enable/disable spellchecker on the website
        document.body.spellcheck = result[StorageKeys.ORTHOGRAPHY]
          ? (document.body.spellcheck = false) //needed here for linkedin, could be removed when we fix focusin issue
          : (document.body.spellcheck = true);

        //Define API requests config
        const requestConfig: RequestConfig = {
          german_gender_ending: result[StorageKeys.GERMAN_GENDER_ENDING].value
            ? result[StorageKeys.GERMAN_GENDER_ENDING].value
            : result[StorageKeys.GERMAN_GENDER_ENDING],
          preferred_variants: result[StorageKeys.PREFERRED_VARIANTS].value
            ? result[StorageKeys.PREFERRED_VARIANTS].value
            : result[StorageKeys.PREFERRED_VARIANTS],
          disabled_categories: [
            result[StorageKeys.ORTHOGRAPHY].value === true ? '' : 'orthography',
            result[StorageKeys.INCLUSIVE].value === true ? '' : 'inclusive',
            result[StorageKeys.STYLE].value === true ? '' : 'style',
            result[StorageKeys.CASING_SITES] &&
            result[StorageKeys.CASING_SITES].includes(
              window.location.hostname.replace('www.', '')
            )
              ? 'casing'
              : '',
          ].filter((category) => category !== ''),
          maximum_importance: result[StorageKeys.MAXIMUM_IMPORTANCE].value
            ? result[StorageKeys.MAXIMUM_IMPORTANCE].value
            : result[StorageKeys.MAXIMUM_IMPORTANCE],
          singular_they: result[StorageKeys.SINGULAR_THEY].value
            ? result[StorageKeys.SINGULAR_THEY].value
            : result[StorageKeys.SINGULAR_THEY],
          show_inspiration_alternatives:
            typeof result[StorageKeys.SHOW_INSPIRATION_ALTERNATIVES].value !=
            undefined
              ? result[StorageKeys.SHOW_INSPIRATION_ALTERNATIVES].value
              : result[StorageKeys.SHOW_INSPIRATION_ALTERNATIVES],
          gendered_roles_format: result[StorageKeys.GENDERED_ROLES_FORMAT].value
            ? result[StorageKeys.GENDERED_ROLES_FORMAT].value
            : result[StorageKeys.GENDERED_ROLES_FORMAT],

          inclusive: result[StorageKeys.INCLUSIVE].value,
          style: result[StorageKeys.STYLE].value,
          orthography: result[StorageKeys.ORTHOGRAPHY].value,
        };
        setReqConfig(requestConfig);
      })
      .catch((error: unknown) => {
        log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
        sendErrorToSentry(error);
      });

    browser.storage.onChanged.addListener(storageChange);
    document.addEventListener('focusin', handleFocusinElement, true);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    return () => {
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
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
        case StorageKeys.API_ENDPOINT_KEY:
          setBaseUrls(changes[item].newValue);
          break;
        case StorageKeys.ACCESS_TOKEN:
          setToken(changes[item].newValue);
          break;
        case StorageKeys.PREFERRED_VARIANTS:
          setReqConfig({
            ...reqConfigRef.current,
            preferred_variants: changes[item].newValue.value
              ? changes[item].newValue.value
              : changes[item].newValue,
          });
          break;
        case StorageKeys.GERMAN_GENDER_ENDING:
          setReqConfig({
            ...reqConfigRef.current,
            german_gender_ending: changes[item].newValue.value
              ? changes[item].newValue.value
              : changes[item].newValue,
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
            show_inspiration_alternatives:
              typeof changes[item].newValue.value != undefined
                ? changes[item].newValue.value
                : changes[item].newValue,
          });
          break;
        case StorageKeys.SINGULAR_THEY:
          setReqConfig({
            ...reqConfigRef.current,
            singular_they: changes[item].newValue.value
              ? changes[item].newValue.value
              : changes[item].newValue,
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
            gendered_roles_format: changes[item].newValue.value
              ? changes[item].newValue.value
              : changes[item].newValue,
          });
      }
    }
  };

  useEffect(() => {
    setRequestConfig(reqConfig);
  }, [reqConfig]);

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
      (inputsRef.current && inputsRef.current.length > 0)
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
      removeAllHoverIndicators();
      if (
        window.location.hostname === 'docs.google.com' &&
        hoveredElementRef.current.classList.contains('cell-input')
      ) {
        return;
      }
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
          element={
            hoveredElementRef.current.tagName === 'TEXTAREA'
              ? hoveredElementRef.current
              : (hoveredElementRef.current.parentElement as CustomInputElement)
          }
          iconType={'passive'}
          isHovered={true}
        />,
        hoveredIndicatorContainer
      );
    } else {
      removeAllHoverIndicators();
    }
  }, [hoveredElementRef.current]);

  const removeAllHoverIndicators = () => {
    const indicatorElements = document.querySelectorAll(
      WTags.WW_MOUSEOVER_INDICATOR
    );
    for (let element of indicatorElements) {
      ReactDOM.unmountComponentAtNode(element);
      element.remove();
    }
  };
  useEffect(() => {
    if (inputs && inputs.length > 0) {
      log(
        `Analyzed inputs:`,
        logTypes.INFO,
        inputs.length > 0 ? inputs : 'None'
      );

      inputs.forEach((input: CustomInputElement) => {
        if (!input.parentElement) return;

        const highlightsContainer: HTMLElement = document.createElement(
          WTags.WW_CONTAINER
        );
        highlightsContainer.style.cssText = WW_CONTAINER_STYLE;

        if (
          window.location.hostname === 'docs.google.com' &&
          input.classList.contains('cell-input')
        ) {
          return;
        }

        input.parentElement.insertBefore(highlightsContainer, input);
        ReactDOM.render(<Input element={input} />, highlightsContainer);
      });
    }
  }, [inputs]);

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
