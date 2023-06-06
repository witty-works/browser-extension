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
  getBaseUrls,
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
  isWittyEditor,
} from '../shared/DOMutils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';
import debounce from 'lodash.debounce';
import { getDomainWithoutSubdomain, storeInLocalStorage } from '../shared/utils';
import Notification from '../Notifications/Notification';
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
  const [, setInputs, inputsRef] = useStateRef([] as CustomInputElement[]);
  const [, setHoveredElement, hoveredElementRef] =
    useStateRef<CustomInputElement | null>(null);
  const [pinNotificationStored, setPinNotificationStored] = useState<boolean | null>(null);

  //observes iframes that are added to the DOM
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      [].filter.call(mutation.addedNodes, function (node: HTMLElement) {
        if (node.nodeName == 'IFRAME') {
          debouncedHandleIframeAdded();
        }
      });
    });
  });

  //debounced handle iframe added, use debounce form lodash
  const debouncedHandleIframeAdded = debounce(() => {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe: any) => {
      if (iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.addEventListener(
          'focusin',
          handleFocusinElement
        );
      }
    });

    return () => {
      iframes.forEach((iframe) => {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          iframe.contentDocument.body.removeEventListener(
            'focusin',
            handleFocusinElement
          );
        }
      });
    };
  }, 500);

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
          
        setPinNotificationStored(result[StorageKeys.PIN_NOTIFICATION_SHOWED]);
        
        //Define API requests config
        const requestConfig: RequestConfig = {
          disabled_categories: [
            result[StorageKeys.ORTHOGRAPHY].value === true ? '' : 'orthography',
            result[StorageKeys.CASING_SITES] &&
            result[StorageKeys.CASING_SITES].includes(
              window.location.hostname.replace('www.', '')
            )
              ? 'casing'
              : '',
          ].filter((category) => category !== ''),
          orthography: result[StorageKeys.ORTHOGRAPHY].value,
        };
        setReqConfig(requestConfig);
      })
      .catch((error: unknown) => {
        log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
        sendErrorToSentry(error);
      });

    //fixes initial iframe focus issue
    if (isGoogleDocs() || isWittyEditor()) {
      const focusedElement = getActiveDocument().activeElement as HTMLElement;
      focusedElement?.blur();
    }

    //Add event listeners
    browser.storage.onChanged.addListener(storageChange);

    !isGoogleDocs() &&
      document.addEventListener('focusin', handleFocusinElement, true);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    return () => {
      browser.storage.onChanged.removeListener(storageChange);

      !isGoogleDocs() &&
        document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  useEffect(() => {
    if(pinNotificationStored === null || window.location.href.includes(getBaseUrls().dashboard)) return;

    if (!pinNotificationStored) {
      const notificationWrapper = document.createElement('div');
      notificationWrapper.id = 'ww-notification';
      ReactDOM.render(
          <Notification
            notificationType={'pin'}
          />,
        document.body.insertBefore(
          notificationWrapper,
          document.body.firstChild
        )
      );
      storeInLocalStorage(StorageKeys.PIN_NOTIFICATION_SHOWED, true);
    }
  }, [pinNotificationStored]);

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
      handleNewInput(); //ensures update
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
          windowScroll={{top: window.scrollY, left: window.scrollX}}
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

  const handleNewInput = () => {
    browser.storage.local.get().then((result) => {
      const disabledDomains = [
        ...(result[StorageKeys.DOMAINS] || []),
        ...(result[StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK] || []),
        ...(result[StorageKeys.ORGANIZATION_DOMAINS]?.list || []),
      ];
      const domain = getDomainWithoutSubdomain(window.location.hostname);
      if (!disabledDomains.includes(domain)) {
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
            const sibling = input.previousElementSibling as HTMLElement;
            if (!sibling || sibling.tagName !== 'WW-CONTAINER') {
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
            }
          });
        }
      }
    });
  };

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
