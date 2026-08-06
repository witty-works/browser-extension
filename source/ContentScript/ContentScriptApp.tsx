import React, {useCallback, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import browser from 'webextension-polyfill';

import {CustomInputElement, RequestConfig} from '../shared/types';
import {useStateRef} from '../shared/customHooks/useStateRef';
import Input from './Input';
import {
  apiKeyFromStorage,
  WTags,
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  registerCustomEndpointFromStorage,
} from '../shared/constants';
import {
  getBaseUrls,
  setAppID,
  setBaseUrls,
  setApiKey,
  setRequestConfig,
  setToken,
} from '../shared/ApiServices/requests';
import {readAccessToken} from '../shared/tokenStore';
import {
  isInputElement,
  nodeExistsInDOM,
  elementIsVisible,
  isChatGpt,
  isGoogleDocs,
  isNotion,
  isGoogleSheets,
  isWittyEditor,
  isGoogleSearch,
  isMicrosoftOnlineExcel,
  isAemRte,
  isMicrosoftOnline,
} from '../shared/DOMutils';
import {sendErrorToSentry} from '../shared/errorUtils';
import {useLog, logTypes} from '../shared/customHooks/useLog';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';
import throttle from 'lodash.throttle';
import {getDomainWithoutSubdomain, storeInLocalStorage} from '../shared/utils';
import renderNotificationToTop from '../Notifications/renderNotification';
//Witty containers' styling
const WW_CONTAINER_STYLE = `
  z-index: 2147483647 !important;
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

export const getActiveDocument = () => activeDocument;

const ContentScriptApp: React.FC = () => {
  const [reqConfig, setReqConfig, reqConfigRef] = useStateRef(
    {} as RequestConfig
  );
  const [, setInputs, inputsRef] = useStateRef([] as CustomInputElement[]);
  const [, setInputsMap, inputsMapRef] = useStateRef(new Map());
  const [, setHoveredElement, hoveredElementRef] =
    useStateRef<CustomInputElement | null>(null);
  const [pinNotificationStored, setPinNotificationStored] = useState<
    boolean | null
  >(null);
  const [, , elementRef] = useStateRef<CustomInputElement | null>(null);

  const log = useLog('ContentScriptApp');

  useEffect(() => {
    if (isGoogleSearch()) return;
    if (isMicrosoftOnline(window.location.href)) return; //needed in addition to the deny list because of iframes

    browser.storage.local
      .get(null)
      .then((result) => {
        setAppID(result[StorageKeys.APP_ID]);
        registerCustomEndpointFromStorage(result);
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        setApiKey(apiKeyFromStorage(result));
        readAccessToken()
          .then(setToken)
          .catch(() => setToken(''));
        storeInLocalStorage(
          StorageKeys.CONFIG_HASH,
          result[StorageKeys.CONFIG_HASH]
        );
        storeInLocalStorage(
          StorageKeys.ORGANIZATION_CONFIG_HASH,
          result[StorageKeys.ORGANIZATION_CONFIG_HASH]
        );

        //Enable/disable spellchecker on the website
        getActiveDocument().body.spellcheck = result[StorageKeys.ORTHOGRAPHY]
          ? (getActiveDocument().body.spellcheck = false) //needed here for linkedin, could be removed when we fix focusin issue
          : (getActiveDocument().body.spellcheck = true);

        setPinNotificationStored(result[StorageKeys.PIN_NOTIFICATION_SHOWED]);

        //Define API requests config
        const domain = getDomainWithoutSubdomain(window.location.hostname);
        const isHrFeatureDisabled =
          result[StorageKeys.HR_FEATURES_DISABLED_DOMAINS]?.includes(domain);
        const requestConfig: RequestConfig = {
          addons: isHrFeatureDisabled ? [] : ['hr'],
          disabled_categories:
            (result[StorageKeys.DISABLED_CATEGORIES] as string[]) || [],
          // Spread rather than set individually: only fields the user actually
          // chose are stored, so the API's own default stands for the rest.
          ...((result[StorageKeys.LANGUAGE_FORMAT] as Record<string, string>) ||
            {}),
        };
        setReqConfig(requestConfig);

        if (result[StorageKeys.EXTENSION_WAS_UPDATED]) {
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
      document?.addEventListener('focusin', handleFocusinElement, true);
    document?.addEventListener('mouseover', handleMouseOver, true);
    document?.addEventListener('mouseout', handleMouseOut, true);

    if (isWittyEditor()) {
      const focusedElement = getActiveDocument()?.activeElement as HTMLElement;
      focusedElement?.blur();
      focusedElement?.focus();
    }

    return () => {
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement, true);
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
    };
  }, []);

  useEffect(() => {
    if (
      pinNotificationStored === null ||
      window.location.href.includes(getBaseUrls().dashboard)
    )
      return;

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
      window.top.document.body.insertBefore(
        notificationWrapper,
        window.top.document.body.firstChild
      );

      renderNotificationToTop(notificationType, elementRef.current);
    } catch (error) {
      DEV_ENV && console.error('Error in renderNotification:', error);
    }
  };

  //TODO specify changes type
  //TODO review all cases
  const storageChange = useCallback((changes: any) => {
    // TODO fix this changes: any ^
    const changedItems = Object.keys(changes);

    for (const item of changedItems) {
      switch (item) {
        case StorageKeys.API_ENDPOINT_KEY:
          setBaseUrls(changes[item].newValue);
          break;
        case StorageKeys.SIGNED_IN:
          // The marker is a boolean; the token itself lives in storage.session,
          // so re-read it rather than assigning the marker.
          changes[item].newValue
            ? readAccessToken()
                .then(setToken)
                .catch(() => setToken(''))
            : setToken('');
          break;
        case StorageKeys.HR_FEATURES_DISABLED_DOMAINS:
          setReqConfig({
            ...reqConfigRef.current,
            addons: changes[item].newValue.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            )
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
    if (
      isMicrosoftOnlineExcel(window.location.href) &&
      target?.id &&
      !target.id.includes('formulaBar')
    ) {
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
      if (target.tagName === 'A') return;
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
      handleNewInput()
        .then((addedInputsMap) => {
          if (addedInputsMap instanceof Map) {
            const mergedInputsMap = new Map([
              ...inputsMapRef.current,
              ...addedInputsMap,
            ]);
            setInputsMap(mergedInputsMap);
          }
        })
        .catch((error) => {
          sendErrorToSentry(error);
        });
    }
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
    if (!hoveredElementRef.current?.isEqualNode(target))
      setHoveredElement(null);
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
      try {
        (hoveredIndicatorContainer as any).__wittyRoot = root;
      } catch (err) {
        // ignore
      }
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

  const removeAllHoverIndicators = async () => {
    const indicatorElements = getActiveDocument().querySelectorAll(
      WTags.WW_MOUSEOVER_INDICATOR
    );
    for (const element of indicatorElements) {
      try {
        const {safeUnmountAndRemove} = await import('./utils');
        safeUnmountAndRemove(element as HTMLElement);
      } catch (err) {
        try {
          element.remove();
        } catch (err2) {
          // ignore
        }
      }
    }
  };
  const handleNewInput = () =>
    browser.storage.local
      .get()
      .then((result) => {
        const addedInputsMap = new Map();

        const disabledDomains = [
          ...(result[StorageKeys.DOMAINS]?.list || []),
          ...((result[StorageKeys.ORGANIZATION_DOMAINS]?.type === 'deny' &&
            result[StorageKeys.ORGANIZATION_DOMAINS]?.list) ||
            []), //could be something wrong here, what if its an allow list?
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
              if (!input?.parentElement) return;
              const sibling = input.previousElementSibling as HTMLElement;

              if (
                sibling?.tagName?.toLowerCase() ===
                  WTags.WW_CONTAINER.toLowerCase() ||
                sibling?.tagName?.toLowerCase() ===
                  WTags.WW_SHADOW_ROOT_CONTAINER.toLowerCase()
              )
                return;

              const shadowHost = getActiveDocument().createElement(
                WTags.WW_SHADOW_ROOT_CONTAINER
              );
              getActiveDocument().body.appendChild(shadowHost);

              const shadowRoot = shadowHost.attachShadow({mode: 'open'});
              const highlightsContainer: HTMLElement =
                getActiveDocument().createElement(WTags.WW_CONTAINER);
              shadowRoot.appendChild(highlightsContainer);

              highlightsContainer.style.cssText = WW_CONTAINER_STYLE;

              if (isGoogleSheets() && input.classList.contains('cell-input'))
                return;
              //get first ancestior that is a div
              const ancestor = input?.closest('div');

              if (isNotion()) {
                //Workaround as Notion blocks insertion of code on a deeper level
                const notionParentElement =
                  document.querySelector('.notion-frame')?.firstChild;
                notionParentElement?.insertBefore(
                  shadowHost,
                  notionParentElement.firstChild
                );
              } else {
                const parentElement =
                  input.tagName === 'rect' ? ancestor : input.parentElement;
                parentElement?.insertBefore(shadowHost, input);
              }
              elementRef.current = input;
              const root = createRoot(highlightsContainer);
              try {
                (shadowHost as any).__wittyRoot = root;
              } catch (err) {
                // ignore
              }
              root.render(<Input element={input} />);

              addedInputsMap.set(input, shadowHost);
            });
          }
        }

        return addedInputsMap;
      })
      .catch((error) => {
        sendErrorToSentry(error);
      });

  const removeOldInput = async (container: HTMLElement | undefined) => {
    if (!container) {
      return;
    }
    if (container.parentNode?.contains(container)) {
      try {
        const {safeUnmountAndRemove} = await import('./utils');
        safeUnmountAndRemove(container as HTMLElement);
      } catch (err) {
        try {
          container.parentNode.removeChild(container);
        } catch (err2) {
          // ignore
        }
      }
    }
  };

  const setupMutationObservers = () => {
    // Check if tracked inputs exists or are still visible
    // If not, remove them from the list of inputs. This way the highlights are also removed
    const inputVisibilityObserver = new MutationObserver(() => {
      inputsRef.current.forEach((input: CustomInputElement) => {
        if (
          !nodeExistsInDOM(getActiveDocument(), input) ||
          !elementIsVisible(input)
        ) {
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
          iframe.contentDocument.body?.addEventListener(
            'focusin',
            handleFocusinElement
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
          }
        });
      };
    }, 200);

    iframeAddedObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  useEffect(() => {
    const shadowObservers = new Map<ShadowRoot, MutationObserver>();

    const addIframeListenersInShadowRoot = (node: ShadowRoot) => {
      node.addEventListener('focusin', handleFocusinElement);

      const iframes = node.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        iframe.contentDocument?.body?.addEventListener(
          'focusin',
          handleFocusinElement
        );
      });
    };

    const observeShadowRoot = (shadowRoot: ShadowRoot) => {
      if (shadowObservers.has(shadowRoot)) return;

      const shadowObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.shadowRoot) {
              observeShadowDomRecursive(node);
            }
            if (node instanceof HTMLIFrameElement) {
              setTimeout(() => {
                node.contentDocument?.body?.addEventListener(
                  'focusin',
                  handleFocusinElement
                );
              }, 1000);
            }
          });
        });
      });

      shadowObserver.observe(shadowRoot, {childList: true, subtree: true});
      shadowObservers.set(shadowRoot, shadowObserver);

      addIframeListenersInShadowRoot(shadowRoot);
    };

    const observeShadowDomRecursive = (node: Element) => {
      if (node.shadowRoot) {
        observeShadowRoot(node.shadowRoot);
      }

      node.querySelectorAll('*').forEach((child) => {
        if (child.shadowRoot) {
          observeShadowRoot(child.shadowRoot);
        }
      });
    };

    const mainObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            observeShadowDomRecursive(node);
          }
        });
      });
    });

    setTimeout(() => {
      mainObserver.observe(document.body, {childList: true, subtree: true});

      document.querySelectorAll('*').forEach((element) => {
        if (element.shadowRoot) {
          observeShadowRoot(element.shadowRoot);
        }
      });
    }, 3000);

    return () => {
      mainObserver.disconnect();
      shadowObservers.forEach((observer) => observer.disconnect());
      shadowObservers.clear();
      console.log('Shadow DOM observers disconnected');
    };
  }, []);

  return <></>;
};

export default ContentScriptApp;
