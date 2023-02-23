import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement, RequestConfig } from '../shared/types';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Input from './Input';
import {
  WTags,
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
} from '../shared/constants';
import {
  setAppID,
  setBaseUrls,
  setConfigHash,
  setOrganizationConfigHash,
  setRequestConfig,
  setToken,
} from '../shared/ApiServices/requests';
import {
  isInputElement,
  nodeExistsInDOM,
  elementIsVisible,
  isChatGpt,
  isGoogleDocs,
  isNotion,
  isGoogleSheets,
} from '../shared/DOMutils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';

//Witty containers' styling
const WW_CONTAINER_STYLE = `
  z-index: auto !important;
  float: left !important;
  display: inline !important;
  width: 0px !important;
  height: 0px !important; 
  top: 0px !important;
  left: 0px !important;
  position: relative !important;
  visibility: visible !important;
  overflow: visible !important;
  padding: 0px !important;
  margin: 0px !important;
  border: none !important;
  box-shadow: none !important;
  `;

let activeDocument = document;
export const setActiveDocument = (document: Document) => {
  if (document && document.body) {
    activeDocument = document;
  }
};

export const getActiveDocument = () => {
  return activeDocument;
};

const ContentScriptApp: React.FC = () => {
  const [reqConfig, setReqConfig, reqConfigRef] = useStateRef(
    {} as RequestConfig
  );
  const [inputs, setInputs, inputsRef] = useStateRef(
    [] as CustomInputElement[]
  );

  const [, setHoveredElement, hoveredElementRef] =
    useStateRef<CustomInputElement | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);

  //observes iframes that are added to the DOM
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      [].filter
        .call(mutation.addedNodes, function (node: HTMLElement) {
          if (node.nodeName == 'IFRAME') {
            setTimeout(() => {
              setIframeLoaded(!iframeLoaded);
            }, 1000);
          }
          return node.nodeName == 'IFRAME';
        })
        .forEach(function (node: HTMLElement) {
          node.addEventListener('load', function () {});
        });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const log = useLog('ContentScriptApp');

  useEffect(() => {
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
        setConfigHash(result[StorageKeys.CONFIG_HASH]);
        setOrganizationConfigHash(result[StorageKeys.ORGANIZATION_CONFIG_HASH]);

        //Enable/disable spellchecker on the website
        getActiveDocument().body.spellcheck = result[StorageKeys.ORTHOGRAPHY]
          ? (getActiveDocument().body.spellcheck = false) //needed here for linkedin, could be removed when we fix focusin issue
          : (getActiveDocument().body.spellcheck = true);

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

    //fixes initial iframe focus issue google docs
    if (isGoogleDocs()) {
      const focusedElement = getActiveDocument().activeElement as HTMLElement;
      focusedElement?.blur();
    }

    //Add event listeners
    browser.storage.onChanged.addListener(storageChange);
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe: any) => {
      if (iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.addEventListener(
          'focusin',
          handleFocusinElement
        );
      }
    });

    !isGoogleDocs() &&
      document.addEventListener('focusin', handleFocusinElement, true);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    return () => {
      browser.storage.onChanged.removeListener(storageChange);
      iframes.forEach((iframe) => {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          iframe.contentDocument.body.removeEventListener(
            'focusin',
            handleFocusinElement
          );
        }
      });
      !isGoogleDocs() &&
        document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [iframeLoaded]);

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
        case StorageKeys.CONFIG_HASH:
          setConfigHash(changes[item].newValue);
          break;
        case StorageKeys.ORGANIZATION_CONFIG_HASH:
          setOrganizationConfigHash(changes[item].newValue);
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
          break;
      }
    }
  };

  useEffect(() => {
    setRequestConfig(reqConfig);
  }, [reqConfig]);

  const handleFocusinElement = (event?: Event) => {
    let target = event?.target as CustomInputElement;
    //if no target, target is the child of #docs-texteventtarget-descendant
    if (isGoogleDocs()) {
      target = document.querySelector(
        '.kix-rotatingtilemanager'
      ) as CustomInputElement;
    } else if (isChatGpt() && DEV_ENV) {
      const textFields = document.querySelectorAll('.markdown');
      target = textFields[textFields.length - 1] as CustomInputElement;
    } else if (isNotion() && target.querySelector('main')) {
      target = target.querySelector('main') as CustomInputElement;
    }

    if (
      (isInputElement(target) && !inputsRef.current.includes(target)) ||
      (isGoogleDocs() && target) ||
      (isChatGpt() && target) ||
      isNotion()
    ) {
      setActiveDocument(target.ownerDocument);
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
        isGoogleSheets() &&
        hoveredElementRef.current.classList.contains('cell-input')
      ) {
        return;
      }
      const hoveredIndicatorContainer: HTMLElement =
        getActiveDocument().createElement(WTags.WW_MOUSEOVER_INDICATOR);
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
    const indicatorElements = getActiveDocument().querySelectorAll(
      WTags.WW_MOUSEOVER_INDICATOR
    );
    for (let element of indicatorElements) {
      ReactDOM.unmountComponentAtNode(element);
      element.remove();
    }
  };
  useEffect(() => {
    //filter out inputs that are the same
    let filteredInputs = inputsRef.current.filter(
      (input, index, self) =>
        index === self.findIndex((t) => t.isEqualNode(input))
    );

    //> 1 prevents issues when starting with empty doc
    if (isGoogleDocs() && filteredInputs.length > 1) {
      //remove any input that does not contain <g> as a child
      filteredInputs = inputsRef.current.filter((input) => {
        const gElements = input.querySelectorAll('g');
        return gElements.length > 0;
      });
    }

    if (filteredInputs && filteredInputs.length > 0) {
      log(
        `Analyzed inputs:`,
        logTypes.INFO,
        filteredInputs.length > 0 ? filteredInputs : 'None'
      );

      filteredInputs.forEach((input: CustomInputElement) => {
        if (!input.parentElement) return;

        // if already has a container, remove them first
        if (document.getElementsByTagName(WTags.WW_CONTAINER).length > 0) {
          // remove all containers
          const containers = document.getElementsByTagName(WTags.WW_CONTAINER);
          for (let container of containers) {
            //make sure each parent of a container only has one child that is a WW_CONTAINER
            const parent = container.parentElement;
            //check if parent has more than one child that is a WW_CONTAINER
            if (parent) {
              //remove all containers except one
              const containers = parent.querySelectorAll(WTags.WW_CONTAINER);
              for (let i = 0; i < containers.length; i++) {
                const childContainer = containers[i];
                ReactDOM.unmountComponentAtNode(childContainer);
                childContainer.remove();
              }
            }
          }
        }

        const highlightsContainer: HTMLElement =
          getActiveDocument().createElement(WTags.WW_CONTAINER);
        highlightsContainer.style.cssText = WW_CONTAINER_STYLE;

        if (isGoogleSheets() && input.classList.contains('cell-input')) {
          return;
        }

        //get first ancestior that is a div
        const ancestor = input.closest('div');

        if (isNotion()) {
          //Workaround as Notion blocks insertion of code on a deeper level
          const notionParentElement =
            document.querySelector('.notion-frame')?.firstChild;
          notionParentElement?.insertBefore(
            highlightsContainer,
            notionParentElement.firstChild
          );
        } else {
          const parentElement =
            input.tagName === 'rect' ? ancestor : input.parentElement;
          parentElement &&
            parentElement.insertBefore(highlightsContainer, input);
        }
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

  mutationObserver.observe(getActiveDocument().body, {
    childList: true,
    subtree: true,
  });

  return <></>;
};

export default ContentScriptApp;
