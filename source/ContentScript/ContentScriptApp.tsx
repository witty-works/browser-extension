import React, {useCallback, useEffect, useState} from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';

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
  isOffice,
  isGoogleSearch,
  isMicrosoftOnlineExcel,
  isAemRte
} from '../shared/DOMutils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';
import throttle from 'lodash.throttle';
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
  align-self: flex-start !important;
  box-shadow: none !important;
  `;

let activeDocument = document;

export const setActiveDocument = (document: Document) => {
  if (document?.body) {
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
  const [, setInputsMap, inputsMapRef] = useStateRef(new Map());
  const [, setHoveredElement, hoveredElementRef] =
    useStateRef<CustomInputElement | null>(null);
  const [pinNotificationStored, setPinNotificationStored] = useState<boolean | null>(null);
  const [, , elementRef] = useStateRef<CustomInputElement | null>(null);

  const log = useLog('ContentScriptApp');

  useEffect(() => {
    if (isGoogleSearch()) return;

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
        storeInLocalStorage(StorageKeys.CONFIG_HASH, result[StorageKeys.CONFIG_HASH]);
        storeInLocalStorage(StorageKeys.ORGANIZATION_CONFIG_HASH, result[StorageKeys.ORGANIZATION_CONFIG_HASH]);

        //Enable/disable spellchecker on the website
        getActiveDocument().body.spellcheck = result[StorageKeys.ORTHOGRAPHY]
          ? (getActiveDocument().body.spellcheck = false) //needed here for linkedin, could be removed when we fix focusin issue
          : (getActiveDocument().body.spellcheck = true);
          
        setPinNotificationStored(result[StorageKeys.PIN_NOTIFICATION_SHOWED]);
        
        //Define API requests config
        const domain = getDomainWithoutSubdomain(window.location.hostname);
        const isHrFeatureDisabled = result[StorageKeys.HR_FEATURES_DISABLED_DOMAINS]?.includes(domain);
        const requestConfig: RequestConfig = {
          addons: isHrFeatureDisabled ? [] : ['hr'],
        };
        setReqConfig(requestConfig);

        if(result[StorageKeys.EXTENSION_WAS_UPDATED]) {
          renderNotification('update');
          browser.storage.local.set({
            [StorageKeys.EXTENSION_WAS_UPDATED]: false,
          });
        }
      })
      .catch((error: unknown) => {
        log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
        sendErrorToSentry(error);
      });

    //Add event listeners
    browser.storage.onChanged.addListener(storageChange);

    // Setup mutation observers
    setupMutationObservers();

    isGoogleDocs() && handleFocusinElement();
    !isGoogleDocs() &&
      document.addEventListener('focusin', handleFocusinElement, true);
    !isGoogleDocs() &&
      document.addEventListener('focusout', handleFocusoutElement, true);
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);

    if (isWittyEditor()) {
      const focusedElement = getActiveDocument()?.activeElement as HTMLElement;
      focusedElement?.blur();
      focusedElement?.focus();
    }

    return () => {
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement, true);
      document.removeEventListener('focusout', handleFocusoutElement, true);
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
    };
  }, []);

  useEffect(() => {
    if(pinNotificationStored === null || window.location.href.includes(getBaseUrls().dashboard)) return;

    if (!pinNotificationStored) {
      renderNotification('pin');
      storeInLocalStorage(StorageKeys.PIN_NOTIFICATION_SHOWED, true);
    }
  }, [pinNotificationStored]);

  const renderNotification = (notificationType: string) => {
    try {
      if (!window.top) return;
  
      const notificationWrapper = document.createElement('div');
      notificationWrapper.id = 'ww-notification';
      window.top.document.body.insertBefore(notificationWrapper, window.top.document.body.firstChild);

      const root = createRoot(notificationWrapper);
      root.render(
        <Notification
          notificationType={notificationType}
          element={elementRef.current}
        />
      );

    } catch (error) {
      DEV_ENV && console.error("Error in renderNotification:", error);
    }
  };
  

  //TODO specify changes type
  //TODO review all cases
  const storageChange = useCallback((changes: any) => {
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
        case StorageKeys.HR_FEATURES_DISABLED_DOMAINS:
          setReqConfig({
            ...reqConfigRef.current,
            addons: 
              changes[item].newValue.includes(getDomainWithoutSubdomain(window.location.hostname))
                ? reqConfigRef.current.addons.filter((addon) => addon !== 'hr')
                : [...reqConfigRef.current.addons, 'hr'],
            });
            break;
      }
    }
  }, []);

  useEffect(() => {
    setRequestConfig(reqConfig);
  }, [reqConfig]);

  const handleFocusinElement = useCallback((event?: Event) => {
    let target = event?.target as CustomInputElement;
    //if no target, target is the child of #docs-texteventtarget-descendant

    //excel only active in formula bar
    if(isMicrosoftOnlineExcel(window.location.href) && target?.id && !target.id.includes('formulaBar')) {
      return;
    }
  
    if (isGoogleDocs()) {
      target = document.querySelector(
        '.kix-rotatingtilemanager'
      ) as CustomInputElement;
    } else if (isChatGpt() && DEV_ENV) {
      const textFields = document.querySelectorAll('.markdown');
      target = textFields[textFields.length - 1] as CustomInputElement;
    } else if (isNotion() && target.querySelector('main')) {
      target = target.querySelector('main') as CustomInputElement;
    } else if (isAemRte(target)) {
      if(target.tagName === 'A') return;     
    } 

    if (
      (isInputElement(target) && !inputsRef.current.includes(target)) ||
      (isGoogleDocs() && target) ||
      (isChatGpt() && target) ||
      isNotion() || 
      isAemRte(target)
    ) {
      setActiveDocument(target.ownerDocument);
      setHoveredElement(null);
      setInputs([...inputsRef.current, target]);
      handleNewInput().then(addedInputsMap => {
        if (addedInputsMap instanceof Map) {
          const mergedInputsMap = new Map([...inputsMapRef.current, ...addedInputsMap]);
          setInputsMap(mergedInputsMap);
        }
      }).catch((error) => {
        sendErrorToSentry(error);
      });
    }
  }, []);

  const handleFocusoutElement = useCallback((event?: Event) => {
    if (
      isGoogleDocs() ||
      isOffice() ||
      isWittyEditor()
    ) {
      return;
    }

    let target = event?.target as CustomInputElement;

    if (!inputsRef.current.includes(target) || !inputsMapRef.current.has(target)) {
      return;
    }

    removeOldInput(inputsMapRef.current.get(target));

    setInputs(inputsRef.current.filter(input => input !== target));
    const inputsMap = inputsMapRef.current;
    inputsMap.delete(target);
    setInputsMap(inputsMap);
  }, []);

  const handleMouseOver = useCallback((event: MouseEvent) => {
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
  }, []);

  const handleMouseOut = useCallback((event: MouseEvent) => {
    const target = event.target as CustomInputElement;
    if (!hoveredElementRef.current?.isEqualNode(target)) setHoveredElement(null);
  }, []);

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
    
      const root = createRoot(hoveredIndicatorContainer);
      root.render(
        <StateIndicatorIcon
          element={
            hoveredElementRef.current.tagName === 'TEXTAREA'
              ? hoveredElementRef.current
              : (hoveredElementRef.current.parentElement as CustomInputElement)
          }
          iconType={'passive'}
          isHovered={true}
        />
      );
    } else {
      removeAllHoverIndicators();
    }
  }, [hoveredElementRef.current]);

  const removeAllHoverIndicators = () => {
    const indicatorElements = getActiveDocument().querySelectorAll(WTags.WW_MOUSEOVER_INDICATOR);
    for (let element of indicatorElements) {
      element.remove();
    }
  };
  const handleNewInput = () => {
    return browser.storage.local.get().then((result) => {
      const addedInputsMap = new Map();

      const disabledDomains = [
        ...(result[StorageKeys.DOMAINS]?.list || []),
        ...(result[StorageKeys.ORGANIZATION_DOMAINS]?.type === 'deny' && result[StorageKeys.ORGANIZATION_DOMAINS]?.list || []), //could be something wrong here, what if its an allow list? 
      ];
      const domain = getDomainWithoutSubdomain(window.location.hostname);
      if (!disabledDomains.includes(domain)) {
        //> 1 prevents issues when starting with empty doc
        if (isGoogleDocs() && inputsRef.current.length > 1) {
          //remove any input that does not contain <g> as a child
          inputsRef.current.filter((input) => {
            const gElements = input.querySelectorAll('g');
            return gElements.length > 0;
          });
        }
        if (inputsRef.current.length > 0) {
          log(
            `Analyzed inputs:`,
            logTypes.INFO,
            inputsRef.current.length > 0 ? inputsRef.current : 'None'
          );
          inputsRef.current.forEach((input: CustomInputElement) => {
            if (!input.parentElement) return;
            const sibling = input.previousElementSibling as HTMLElement;
            if (sibling?.tagName === 'WW-CONTAINER') return;
            const highlightsContainer: HTMLElement =
              getActiveDocument().createElement(WTags.WW_CONTAINER);
            highlightsContainer.style.cssText = WW_CONTAINER_STYLE;

            if (isGoogleSheets() && input.classList.contains('cell-input')) return;
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
                  parentElement?.insertBefore(highlightsContainer, input);
              }
              elementRef.current = input;
              const root = createRoot(highlightsContainer);
              root.render(<Input element={input} />);

              addedInputsMap.set(input, highlightsContainer);
          });
        }
      }

      return addedInputsMap;
    }).catch((error) => {
      sendErrorToSentry(error);
    });
  };

  const removeOldInput = (container: HTMLElement | undefined) => {
    if (!container) {
      return;
    }
    if (container.parentNode?.contains(container)) {
      container.parentNode.removeChild(container);
    }
  };

  const setupMutationObservers = () => {
    // Check if tracked inputs exists or are still visible
    // If not, remove them from the list of inputs. This way the highlights are also removed
    const inputVisibilityObserver = new MutationObserver(() => {
      inputsRef.current.forEach((input: CustomInputElement) => {
        if (!nodeExistsInDOM(input) || !elementIsVisible(input)) {
          removeOldInput(inputsMapRef.current.get(input));

          setInputs([
            ...inputsRef.current.filter(
                (filterInput: CustomInputElement) => filterInput !== input
            ),
          ]);
          const inputsMap = inputsMapRef.current;
          inputsMap.delete(input);
          setInputsMap(inputsMap);
        }
      });
    });

    inputVisibilityObserver.observe(getActiveDocument().body, {
      childList: true,
      subtree: true,
    });

    //observes iframes that are added to the DOM
    const iframeAddedObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        [].filter.call(mutation.addedNodes, function (node: HTMLElement) {
          if (node?.nodeName == 'IFRAME') {
            throttledHandleIframeAdded();
          }
        });
      });
    });

    const throttledHandleIframeAdded = throttle(() => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe: HTMLIFrameElement) => {
        if (iframe.contentDocument?.body) {
          iframe.contentDocument.body.addEventListener(
              'focusin',
              handleFocusinElement
          );
          iframe.contentDocument.body.addEventListener(
              'focusout',
              handleFocusoutElement
          );
        }
      });

      return () => {
        iframes.forEach((iframe: HTMLIFrameElement) => {
          if (iframe.contentDocument?.body) {
            iframe.contentDocument.body.removeEventListener(
                'focusin',
                handleFocusinElement
            );
            iframe.contentDocument.body.removeEventListener(
                'focusout',
                handleFocusoutElement
            );
          }
        });
      };
    }, 200);

    iframeAddedObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  return <></>;
};

export default ContentScriptApp;
