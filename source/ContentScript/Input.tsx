import React, {useState, useEffect, useCallback, useRef} from 'react';
import browser, {Runtime} from 'webextension-polyfill';
import {Root, createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import defaultConfig from '../witty.config.json';
import {WTags, StorageKeys, DEV_ENV} from '../shared/constants';
import {useTranslation} from 'react-i18next';
import {namespaces} from '../i18n/i18n.constants';
// import Notification from '../Notifications/Notification'; //Temporarily removed until we have a better solution
import TextAreaClone from './TextAreaClone';
import renderNotificationToTop from '../Notifications/renderNotification';
import {useLog, logTypes} from '../shared/customHooks/useLog';
import {
  CustomInputElement,
  IAlert,
  ICheckResponse,
  INodes,
  INodeWithAlerts,
  Position,
} from '../shared/types';
import {
  storeInLocalStorage,
  getNewAccessToken,
  getDomainWithoutSubdomain,
  updateConfig,
  isSignedInResult,
} from '../shared/utils';
import {
  isTextArea,
  isInputText,
  isCkEditor,
  isGoogleDocs,
  isLinkedin,
  isNotion,
  isMicrosoftOnlineWord,
  isOutlook,
  isInShadowDOM,
} from '../shared/DOMutils';
import {useResizeObserver} from '../shared/customHooks/useResizeObserver';
import {useMutationObserver} from '../shared/customHooks/useMutationObserver';
import {useStateRef} from '../shared/customHooks/useStateRef';
import {debounce} from 'lodash';
import HighlightPopover, {
  PopoverData,
} from './HighlightPopover/HighlightPopover';
import InputTextClone from './InputTextClone';
import Highlights from './Highlights';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';
import Toast from '../shared/components/Toast/Toast';
import {sendErrorToSentry} from '../shared/errorUtils';
import {useAuthEndpoint} from '../shared/ApiServices/useAuthEndpoint';
import GoogleDocsClone from './GoogleDocsClone';
import {
  findCloneContainer,
  getFirstTextDiff,
  getInputText,
  getScrollParent,
  getTextDividedByNodes,
  shouldReturnEarly,
} from './utils';
import {getActiveDocument} from './ContentScriptApp';
import HighlightPopoverNotSignedIn from './HighlightPopover/HighlightPopoverNotSignedIn';
import {useCheckEndpointWithCache} from '../shared/ApiServices/useCheckEndpointWithCache';
import {useCheckEventsLogger} from '../shared/ApiServices/useCheckEventsLogger';
import {useLLMAlternativesCache} from '../shared/ApiServices/useLLMAlternativesCache';
import {MessageTypes} from '../shared/messages';

const Input: React.FC<{
  element: CustomInputElement;
}> = ({element}) => {
  // const [checkEndpointResponse, checkEndpointError, setTextToCheck] =
  //   useCheckEndpoint();
  const [authResponse, authErrorResponse, setConfigHasChanged] =
    useAuthEndpoint();
  const [, , previousElementStateRef] = useStateRef<{
    text: string[] | string;
    position: DOMRect;
  }>({text: [], position: {} as DOMRect});

  const [currentTextToCheck, setCurrentTextToCheck] = useState('');
  const prevTextRef = useRef(currentTextToCheck);
  const [clone, setClone, cloneRef] = useStateRef({} as HTMLElement);
  const elementRect = useResizeObserver(element);

  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [elementScroll, setElementScroll] = useState<Position>({
    top: isTextArea(element) ? element.scrollTop : 0,
    left: isTextArea(element) ? element.scrollLeft : 0,
  } as Position);
  const [removeHighlights, setRemoveHighlights] = useState<boolean>(false);
  const [forceHighlightUpdate, setForceHighlightUpdate] =
    useState<boolean>(false);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);
  const [, , nodesWithAlertsRef] = useStateRef([] as INodeWithAlerts[]);
  const [, , prevCheckedNodesRef] = useStateRef([] as INodes[]);
  const [, , nodesStorageRef] = useStateRef([] as INodes[]);
  const [selectedNodeWithAlertsIndex, setSelectedNodeWithAlertsIndex] =
    useState<number>(-1);
  const [selectedAlertIndex, setSelectedAlertIndex, prevSelectedAlertIndex] =
    useStateRef<number>(-1);
  const [, , selectedAlertRef] = useStateRef<IAlert | null>(null);
  const [, , popoverDataRef] = useStateRef<PopoverData | null>(null);
  const [, , previousPopoverDataRef] = useStateRef<PopoverData | null>(null);
  const [activeIcon, setActiveIcon, activeIconRef] = useStateRef('active');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [elementXPathResult, setElementXPathResult] = useState<XPathResult>();
  const [debounceDelay, setDebounceDelay] = useState<number>(
    defaultConfig.API_DELAY
  );
  const [userIsSignedIn, setUserIsSignedIn] = useState<boolean>(false);
  // const minCharLength = defaultConfig.MIN_CHAR_LENGTH;
  const totalMaxCharLength = defaultConfig.MAX_CHAR_LENGTH_TOTAL;
  const [, , totalMaxCharLengthReachedRef] = useStateRef<boolean>(false);
  const [, , firstScrollableParentRef] = useStateRef<HTMLElement>(element);
  const [, , previouslyCheckedPagesGoogleDocs] = useStateRef<number[]>([]);
  const [, , previousScrollTopRef] = useStateRef<number>(0);
  const [, , popoverRootRef] = useStateRef<Root | null>(null);
  // Set when the popover is opened or advanced via the keyboard shortcut, so
  // the popover knows to take focus. Cleared for the mouse flows, which must
  // never steal focus from the input while the user is typing.
  const openedViaKeyboardRef = useRef<boolean>(false);
  const [, , elementSpellcheckRef] = useStateRef<boolean>(false);
  const [hrFeatureDisabled, setHrFeatureDisabled] = useState<boolean>(false);
  const checkEventsLogger = useCheckEventsLogger(
    authResponse,
    hrFeatureDisabled
  );

  const onNewCheckResultsReceived = (
    checkEndpointResponse: ICheckResponse,
    checkedTextLength: number
  ) => {
    userIsSignedIn &&
      checkEventsLogger.checkLog(checkEndpointResponse, checkedTextLength);
    userIsSignedIn &&
      checkEventsLogger.logNewCheckResponses(
        checkEndpointResponse,
        checkedTextLength
      );
  };

  const [
    checkEndpointCachedResponse,
    checkEndpointError,
    setTextToCheck,
    adjustLocalAlertPositions,
  ] = useCheckEndpointWithCache(onNewCheckResultsReceived);
  const [LLMSuggestionsCache, setLLMSuggestionsRequest, getLLMSuggestions] =
    useLLMAlternativesCache();

  const onElementMutation = useCallback(
    (mutationsList: MutationRecord[]) => {
      if (isGoogleDocs()) {
        setActiveIcon('loading');
        debouncedMutation();
      } else {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            docTextEvaluation(element, cloneRef.current);
          }
        }
      }
    },
    [element]
  );
  const debouncedMutation = debounce(() => {
    googleDocsMutationHandler();
  }, 500);

  const googleDocsMutationHandler = () => {
    const cloneContainer = findCloneContainer();
    if (!cloneContainer) return;
    //if no text, remove highlights
    if (!element.querySelector('g')) {
      setAlerts([]);
    }

    const container = findCloneContainer();
    if (!container) return;
    const root = createRoot(container);

    root.render(
      <GoogleDocsClone
        element={element}
        previousElement={previousElementStateRef.current}
        updateClone={updateCloneData}
      />
    );
    setActiveIcon('active');

    //Deals with new pages getting rendered in google docs
    const pages = element.querySelectorAll('.kix-page-paginated');
    const pagesZIndex = Array.from(pages).map((page) => {
      //z-index = page number
      const zIndex = window.getComputedStyle(page).getPropertyValue('z-index');
      return parseInt(zIndex);
    }) as number[];
    if (
      !pagesZIndex.every((page) =>
        previouslyCheckedPagesGoogleDocs.current.includes(page)
      ) &&
      isGoogleDocs()
    ) {
      previouslyCheckedPagesGoogleDocs.current = [
        ...new Set([
          ...previouslyCheckedPagesGoogleDocs.current,
          ...pagesZIndex,
        ]),
      ];
    }
  };

  useMutationObserver(element, onElementMutation);
  const {t} = useTranslation([namespaces.errors]);
  const log = useLog('Input');

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setUserIsSignedIn(isSignedInResult(result));
        setDebounceDelay(defaultConfig.API_DELAY);
        elementSpellcheckRef.current = !!result[StorageKeys.ORTHOGRAPHY];
        const domain = getDomainWithoutSubdomain(window.location.hostname);
        domain &&
          result[StorageKeys.HR_FEATURES_DISABLED_DOMAINS] &&
          setHrFeatureDisabled(
            result[StorageKeys.HR_FEATURES_DISABLED_DOMAINS].includes(domain)
          );
      })
      .catch((error: unknown) => {
        sendErrorToSentry(error);
      });

    browser.storage.onChanged.addListener(storageChange);
    const scrollParent = getScrollParent(element);
    const newScrollableParent =
      !isTextArea(element) && scrollParent ? scrollParent : element;
    if (newScrollableParent)
      firstScrollableParentRef.current = newScrollableParent;

    if (isGoogleDocs()) {
      setIsFocused(true);
    } else {
      element?.addEventListener('focusout', handleFocusoutEvent);
      element?.addEventListener('focusin', handleFocusinEvent);
    }
    element?.addEventListener('mouseover', handleMouseoverEvent);
    element?.addEventListener('mouseout', handleMouseoutEvent);
    newScrollableParent?.addEventListener('scroll', handleElementScrollEvent);

    element?.addEventListener(
      'dblclick',
      handleElementClickEventWrapper as any
    );
    element?.addEventListener(
      'pointerdown',
      handleElementClickEventWrapper as any
    );

    if (isGoogleDocs()) {
      document?.addEventListener(
        'click',
        handleDocumentClickEvent as EventListener
      );
      document?.addEventListener('scroll', handleElementScrollEvent);
      window?.addEventListener('resize', handleDocumentResizeEvent);
    }

    //If a parent form exists, we will monitor the submision.
    //This will allow us remove remaining highlights when text disappear
    const parentForm: HTMLFormElement | null = isTextArea(element)
      ? element.form
      : element?.closest('form');

    if (parentForm)
      parentForm?.addEventListener('submit', handleSubmitFormEvent);

    return () => {
      //Don't forget to remove the listeners at the end
      if (!isGoogleDocs()) {
        element.removeEventListener('focusout', handleFocusoutEvent);
        element.removeEventListener('focusin', handleFocusinEvent);
      }

      newScrollableParent.removeEventListener(
        'scroll',
        handleElementScrollEvent
      );

      element.removeEventListener(
        'dblclick',
        handleElementClickEventWrapper as any
      );
      element.removeEventListener(
        'pointerdown',
        handleElementClickEventWrapper as any
      );

      if (isGoogleDocs()) {
        document.removeEventListener(
          'click',
          handleDocumentClickEvent as EventListener
        );
        document.removeEventListener('scroll', handleElementScrollEvent);
        window.removeEventListener('resize', handleDocumentResizeEvent);
      }

      if (parentForm)
        parentForm.removeEventListener('submit', handleSubmitFormEvent);
    };
  }, []);

  //GOOGLE DOCS WORKAROUND
  const handleDocumentClickEvent = () => {
    if (getInputText(cloneRef.current).length === 0) debouncedMutation();
    const activeDocument = getActiveDocument();
    if (
      isGoogleDocs() &&
      !activeDocument.getElementById('witty-works-ext-popover')
    ) {
      // Recalculate alert rects for Google Docs and pick alerts under the caret/click
      const alertsInRange: IAlert[] = [];
      let selectedNode: Node | null = null;

      // Attempt to get a caret/selection rect for the current document
      let googleDocsElementCursorRect: DOMRect | null = null;
      try {
        const sel = getActiveDocument().getSelection();
        if (sel && sel.rangeCount > 0) {
          const selRange = sel.getRangeAt(0).cloneRange();
          const selRects = selRange.getClientRects();
          if (selRects && selRects.length > 0)
            googleDocsElementCursorRect = selRects[0];
        }
      } catch (err) {
        // ignore selection failures
      }

      // Recalculate rects for every alert where possible
      const updatedNodesWithAlerts = nodesWithAlertsRef.current.map(
        (nodeWithAlerts) => {
          const nodeWithAlertsRefWithUpdatedRects = {
            ...nodeWithAlerts,
            alerts: nodeWithAlerts.alerts.map((alert) => {
              try {
                const range = getActiveDocument().createRange();
                const nodeForRange =
                  nodeWithAlerts.node &&
                  nodeWithAlerts.node.nodeType === Node.TEXT_NODE
                    ? nodeWithAlerts.node
                    : nodeWithAlerts.node?.childNodes[0];
                if (!nodeForRange) return alert;

                if (
                  alert.endOffset <= (nodeForRange.textContent || '').length &&
                  alert.startOffset <= (nodeForRange.textContent || '').length
                ) {
                  range.selectNode(nodeForRange as Node);
                  range.setStart(nodeForRange as Node, alert.startOffset);
                  range.setEnd(nodeForRange as Node, alert.endOffset);
                }
                const rect = range.getClientRects()[0];
                if (!rect) return alert;
                return {
                  ...alert,
                  rect: {
                    ...rect,
                    width: rect.width,
                    height: rect.height,
                    left: rect.left,
                    top: rect.top - elementScroll.top,
                  },
                };
              } catch (error) {
                sendErrorToSentry(error);
                return alert;
              }
            }),
          };
          return nodeWithAlertsRefWithUpdatedRects;
        }
      );

      updatedNodesWithAlerts.forEach((node) => {
        const alertRects = node.alerts.map((alert) => alert.rect);

        alertRects.forEach((alertRect) => {
          if (
            alertRect &&
            googleDocsElementCursorRect &&
            googleDocsElementCursorRect.top + 2 <=
              alertRect.top + alertRect.height &&
            googleDocsElementCursorRect.top + 2 >= alertRect.top && //+ 2 adds some slack for weird fonts
            googleDocsElementCursorRect.left + 2 >= alertRect.left && //+ 2 to add some slack when clickin in front of the word
            googleDocsElementCursorRect.left + 2 <=
              alertRect.left + alertRect.width
          ) {
            //get alert at alertRect
            const alert = node.alerts.find(
              (alert) =>
                alert.rect &&
                alert.rect.top === alertRect.top &&
                alert.rect.left === alertRect.left
            );
            selectedNode = node.node;
            alert && alertsInRange.push(alert);
          }
        });
      });

      const selectedAlert =
        alertsInRange.length > 1
          ? alertsInRange[alertsInRange.length - 1]
          : alertsInRange[0];

      //get index of selected alert in nodesWithAlertsRef.current
      const newSelectedNodeWithAlertsIndex = updatedNodesWithAlerts.findIndex(
        (node) => node.node === selectedNode
      );

      const newSelectedAlertIndex = updatedNodesWithAlerts[
        newSelectedNodeWithAlertsIndex
      ]?.alerts.findIndex((alert) => alert === selectedAlert);

      setSelectedNodeWithAlertsIndex(newSelectedNodeWithAlertsIndex);
      setSelectedAlertIndex(newSelectedAlertIndex ?? -1);
    }
  };

  useEffect(() => {
    const event = new KeyboardEvent('keyup');
    handleKeyupEventDebounced(event);
    handleTextChanged();

    const targetElement = isNotion()
      ? document.querySelector('.notion-frame')
      : isGoogleDocs()
        ? (document.querySelector('.docs-texteventtarget-iframe') as any)
            ?.contentDocument?.activeElement
        : element;

    targetElement?.addEventListener('keyup', handleKeyupEventDebounced as any);
    element?.addEventListener('paste', handleKeyupEventDebounced as any);

    targetElement?.addEventListener('keyup', handleTextChanged as any);
    element?.addEventListener('paste', handleTextChanged as any);

    return () => {
      const targetElement = isNotion()
        ? document.querySelector('.notion-frame')
        : isGoogleDocs()
          ? (document.querySelector('.docs-texteventtarget-iframe') as any)
              ?.contentDocument?.activeElement
          : element;

      targetElement?.removeEventListener(
        'keyup',
        handleKeyupEventDebounced as any
      );
      element?.removeEventListener('paste', handleKeyupEventDebounced as any);

      targetElement?.removeEventListener('keyup', handleTextChanged as any);
      element?.removeEventListener('paste', handleTextChanged as any);
    };
  }, [debounceDelay]);

  useEffect(() => {
    if (!authResponse) return;
    updateConfig(authResponse);
  }, [authResponse]);

  useEffect(() => {
    docTextEvaluation(element, cloneRef.current);
  }, [element, cloneRef.current]);

  const handleMouseoverEvent = () => {
    if (activeIconRef.current == 'passive') setIsHovered(true);
  };

  const handleMouseoutEvent = () => {
    if (activeIconRef.current == 'passive') setIsHovered(false);
  };

  const handleFocusoutEvent = (event?: Event) => {
    // Focus moving into the popover (keyboard navigation) must not count as
    // leaving the field: unmounting the clone would detach the nodes the
    // alerts point at, and repositioning the popover on the next/previous
    // alert needs their client rects.
    const next = (event as FocusEvent | undefined)
      ?.relatedTarget as Node | null;
    if (
      next &&
      document.getElementById('witty-works-ext-popover')?.contains(next)
    ) {
      return;
    }
    setIsFocused(false);
    setActiveIcon('passive');
  };

  const handleFocusinEvent = () => {
    if (isMicrosoftOnlineWord(window.location.href)) {
      const event = new KeyboardEvent('keyup');
      handleKeyupEventDebounced(event);
      handleTextChanged();
    }
    setIsFocused(true);
    setActiveIcon('active');
  };

  const handleDocumentResizeEvent = () => {
    setAlerts([]);
    debouncedMutation();
  };

  const handleKeyupEventDebounced = debounce((keyboardEvent: KeyboardEvent) => {
    if (prevSelectedAlertIndex.current != -1 && !isGoogleDocs()) resetPopover();
    const isSpecialKey =
      !keyboardEvent?.key ||
      keyboardEvent.key === 'z' ||
      keyboardEvent.key === 'Meta';
    !isGoogleDocs() && (element.spellcheck = !elementSpellcheckRef.current);

    if (isGoogleDocs()) {
      googleDocsMutationHandler();
    }

    const nextTextDividedByNodes = getTextDividedByNodes(element);
    if (
      !isSpecialKey &&
      shouldReturnEarly(
        prevCheckedNodesRef.current,
        nextTextDividedByNodes.map((node) => node.node)
      )
    )
      return;
    const textDividedByNodesTextContent = isTextArea(element)
      ? getInputText(element)
      : (nextTextDividedByNodes.map((node) => node.text) as string[]);

    if (isTextArea(element)) {
      handleTextAndIcon();
    } else {
      !isGoogleDocs() && setAlerts([]);
      handleTextAndIcon();
    }

    previousElementStateRef.current = {
      text: textDividedByNodesTextContent,
      position: element.getBoundingClientRect(),
    };
  }, 200); //for getFirstTextDiff not to be overwhemled by too many calls. There is a seperate debounce for requests.

  const handleTextChanged = () => {
    const nextText: string = getInputText(
      isGoogleDocs() ? cloneRef.current : element
    );
    const previousText = prevTextRef.current;

    const firstTextDiff = getFirstTextDiff(previousText, nextText);
    if (firstTextDiff) {
      adjustLocalAlertPositions(
        firstTextDiff.changedOffset,
        firstTextDiff.originalLength,
        firstTextDiff.newLength
      );
    }

    prevTextRef.current = nextText;
  };

  const handleTextAndIcon = () => {
    const nextText: string = getInputText(
      isGoogleDocs() ? cloneRef.current : element
    );
    setCurrentTextToCheck(nextText); //for check call after refresh token
    if (nextText.length === 0 || !nextText.match(/[a-zA-Z0-9.:;,?!]/i)) {
      setActiveIcon('active');
      setAlerts([]);
      checkText('');
    } else {
      debouncedSetTextToCheck(nextText);
      setActiveIcon('loading');
    }

    totalMaxCharLengthReachedRef.current = nextText.length > totalMaxCharLength;
  };

  /**
   * Single egress point for the user's text. Nothing is sent to the API unless
   * the extension is actually signed in.
   *
   * This guard previously keyed off the plan (`PLAN !== 'none'`), so removing
   * the commercial gating removed it by accident — which meant a signed-out
   * user's keystrokes were POSTed to /v2.4/check and merely rejected at the far
   * end. Storage is re-read on each call rather than closing over
   * `userIsSignedIn`, because this runs from a debounced callback where React
   * state would be stale.
   */
  const checkText = (text: string) => {
    browser.storage.local
      .get(null)
      .then((result) => {
        if (isSignedInResult(result)) {
          setTextToCheck(text);
        }
      })
      .catch((error: unknown) => {
        sendErrorToSentry(error);
      });
  };

  const debouncedSetTextToCheck = debounce((text: string) => {
    //In this case always create a new string to force change the state of setTextToCheck
    checkText(text);
  }, debounceDelay);

  const handleElementScrollEvent = () => {
    if (
      !isTextArea(element) &&
      previousScrollTopRef.current !==
        firstScrollableParentRef.current.scrollTop
    ) {
      previousScrollTopRef.current = firstScrollableParentRef.current.scrollTop;
      setActiveIcon('loading');
      debouncedScroll();
    }

    !isGoogleDocs() &&
      setElementScroll({
        top: isTextArea(element) ? element.scrollTop : 0,
        left: isTextArea(element)
          ? element.scrollLeft
          : firstScrollableParentRef.current.scrollLeft,
      });
  };

  const debouncedScroll = debounce(() => {
    setActiveIcon('active');
  }, debounceDelay);

  const handleSubmitFormEvent = () => {
    //It's assumed that when user sends info through a form, text will disappear.
    //Therefore highlights also need to be removed
    setAlerts([]);
  };

  const docTextEvaluation = (element: HTMLElement, clone: HTMLElement) => {
    const elementEvaluation: XPathResult = getActiveDocument().evaluate(
      './/text()',
      isGoogleDocs() && clone.nodeType == 1 ? clone : element,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    setElementXPathResult(elementEvaluation);
  };

  const updateCloneData = (newClone: HTMLDivElement) => {
    setClone(newClone);
    if (isGoogleDocs()) {
      const event = new KeyboardEvent('keyup');
      handleKeyupEventDebounced(event);
      handleTextChanged();
    }
  };

  const resetPopover = () => {
    // Unmount any React root and remove DOM on next tick to avoid
    // 'synchronously unmount a root while React was already rendering' warnings.
    const rootToUnmount = popoverRootRef.current;
    popoverRootRef.current = null;

    // schedule unmount and DOM removal after current render completes
    if (rootToUnmount) {
      setTimeout(() => {
        try {
          rootToUnmount.unmount();
        } catch (err) {
          // ignore
        }

        try {
          const popoverContainers =
            window.document.getElementsByTagName('ww-popover');
          Array.from(popoverContainers).forEach((popoverContainer) => {
            popoverContainer.remove();
          });
        } catch (err) {
          // ignore
        }
      }, 0);
    } else {
      // no root, still remove lingering containers synchronously
      try {
        const popoverContainers =
          window.document.getElementsByTagName('ww-popover');
        Array.from(popoverContainers).forEach((popoverContainer) => {
          popoverContainer.remove();
        });
      } catch (err) {
        // ignore
      }
    }

    event?.stopPropagation();
    if (popoverDataRef.current !== null)
      previousPopoverDataRef.current = popoverDataRef.current;
    popoverDataRef.current = null;
    selectedAlertRef.current = null;
    openedViaKeyboardRef.current = false;
    setSelectedAlertIndex(-1);
  };

  const addIgnoredTerm = (term: string): void => {
    setIgnoredTerms([...ignoredTerms, term]);
  };

  const handleElementClickEvent = (event: MouseEvent) => {
    openedViaKeyboardRef.current = false;
    const target = event.target as CustomInputElement;
    setTimeout(
      () => {
        // Get caret data
        const caret: {position: number | null; element: Node | null} =
          isTextArea(element) || isInputText(element)
            ? {
                position: element.selectionStart,
                element: cloneRef.current,
              }
            : {
                position: (getActiveDocument().getSelection() as Selection)
                  .anchorOffset,
                element: (getActiveDocument().getSelection() as Selection)
                  .anchorNode,
              };
        if (event.detail === 2 && caret.position) {
          caret.position = caret.position + 1;
        }
        if (caret.element && caret.position !== null) {
          // Find out if the clicked element has alerts
          const selectedNodeWithAlertsIndex: number =
            nodesWithAlertsRef.current.findIndex(
              (nodeWithAlerts: INodeWithAlerts) =>
                isTextArea(target) || isInputText(target)
                  ? nodeWithAlerts.node?.parentNode === caret.element
                  : nodeWithAlerts.node === caret.element
            );
          setSelectedNodeWithAlertsIndex(selectedNodeWithAlertsIndex);

          const oneNodeWithAlerts =
            nodesWithAlertsRef.current[selectedNodeWithAlertsIndex];
          if (oneNodeWithAlerts) {
            const caretPos = caret.position;

            let selectedAlertIndex = oneNodeWithAlerts?.alerts.findIndex(
              (alert: IAlert) => {
                if (!alert) {
                  return false;
                }

                return (
                  alert.startOffset <= caretPos && alert.endOffset >= caretPos
                );
              }
            );

            const selectedAlerts = oneNodeWithAlerts.alerts.filter(
              (alert: IAlert) =>
                alert.startOffset <= caretPos && alert.endOffset >= caretPos
            );

            if (selectedAlerts.length > 1) {
              const alertWithLargestStartoffset = selectedAlerts.reduce(
                (prev: IAlert, current: IAlert) =>
                  prev.startOffset > current.startOffset ? prev : current
              );

              selectedAlertIndex = oneNodeWithAlerts?.alerts.findIndex(
                (alert: IAlert) =>
                  alert.startOffset === alertWithLargestStartoffset.startOffset
              );
            }
            if (prevSelectedAlertIndex.current === selectedAlertIndex) {
              resetPopover();
              return;
            }

            setSelectedAlertIndex(selectedAlertIndex);
          }
        }
      },
      isInShadowDOM(element) ? 200 : 0
    );
  };

  const handleElementClickEventWrapper = isInShadowDOM(element)
    ? handleElementClickEvent
    : debounce(handleElementClickEvent, 200);

  const movePopoverNextOrPrev = (direction: string): void => {
    if (direction === 'previous') {
      if (selectedAlertIndex === 0) {
        setSelectedNodeWithAlertsIndex(selectedNodeWithAlertsIndex - 1);
        setSelectedAlertIndex(
          nodesWithAlertsRef.current[selectedNodeWithAlertsIndex - 1].alerts
            .length - 1
        );
      } else {
        setSelectedAlertIndex(selectedAlertIndex - 1);
      }
    } else {
      if (
        selectedAlertIndex ===
        nodesWithAlertsRef.current[selectedNodeWithAlertsIndex].alerts.length -
          1
      ) {
        setSelectedNodeWithAlertsIndex(selectedNodeWithAlertsIndex + 1);
        setSelectedAlertIndex(0);
      } else {
        setSelectedAlertIndex(selectedAlertIndex + 1);
      }
    }
    event?.stopPropagation();
  };

  const openFirstAlertPopover = (): void => {
    const firstNodeIndex = nodesWithAlertsRef.current.findIndex(
      (node) => node.alerts.length > 0
    );
    if (firstNodeIndex === -1) {
      return;
    }
    openedViaKeyboardRef.current = true;
    setSelectedNodeWithAlertsIndex(firstNodeIndex);
    setSelectedAlertIndex(0);
  };

  // The keyboard shortcut cycles: past the last alert it wraps back to the
  // first, unlike the popover arrow buttons, which stop at the ends.
  const moveToNextAlertOrWrap = (): void => {
    const nodes = nodesWithAlertsRef.current;
    let lastNodeIndex = -1;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].alerts.length > 0) {
        lastNodeIndex = i;
        break;
      }
    }
    const atLastAlert =
      lastNodeIndex === -1 ||
      (selectedNodeWithAlertsIndex === lastNodeIndex &&
        selectedAlertIndex === nodes[lastNodeIndex].alerts.length - 1);

    if (atLastAlert) {
      openFirstAlertPopover();
    } else {
      openedViaKeyboardRef.current = true;
      movePopoverNextOrPrev('next');
    }
  };

  useEffect(() => {
    // Fired when the user presses the shortcut declared in the manifest; the
    // background worker forwards it to every frame of the active tab (see
    // Background/index.tsx).
    const handleCommandMessage = (
      message: unknown,
      sender: Runtime.MessageSender
    ) => {
      if (
        sender.id !== browser.runtime.id ||
        (message as {type?: unknown} | null)?.type !== MessageTypes.OPEN_POPOVER
      ) {
        return undefined;
      }

      // This instance already shows the popover: advance to the next alert.
      if (popoverDataRef.current) {
        moveToNextAlertOrWrap();
        return undefined;
      }

      // Several Input instances may be mounted (one per watched field, per
      // frame); only the one bound to the focused field opens its popover.
      const activeDocument = getActiveDocument();
      const active = activeDocument.activeElement;
      const ownsFocus =
        activeDocument.hasFocus?.() &&
        active !== null &&
        (element === active || element.contains?.(active));
      if (ownsFocus) {
        openFirstAlertPopover();
      }
      return undefined;
    };

    browser.runtime.onMessage.addListener(handleCommandMessage);
    return () => browser.runtime.onMessage.removeListener(handleCommandMessage);
  }, [selectedNodeWithAlertsIndex, selectedAlertIndex]);

  useEffect(() => {
    prevSelectedAlertIndex.current = selectedAlertIndex;
    if (
      nodesWithAlertsRef.current.length > 0 &&
      selectedNodeWithAlertsIndex > -1 &&
      selectedAlertIndex > -1
    ) {
      const oneNodeWithAlerts =
        nodesWithAlertsRef.current[selectedNodeWithAlertsIndex];

      const selectedAlert = oneNodeWithAlerts.alerts[selectedAlertIndex];
      selectedAlertRef.current = selectedAlert;

      const range = getActiveDocument().createRange();
      const nodeText =
        oneNodeWithAlerts.node.nodeType === Node.TEXT_NODE
          ? oneNodeWithAlerts.node
          : oneNodeWithAlerts.node.childNodes[0];

      if (
        nodeText.textContent &&
        (!selectedAlert ||
          selectedAlert.endOffset > nodeText.textContent.length ||
          selectedAlert.startOffset > nodeText.textContent.length)
      )
        return;

      range.setStart(nodeText, selectedAlert.startOffset);
      range.setEnd(nodeText, selectedAlert.endOffset);
      const rect = range.getClientRects()[0];
      if (!rect) return;
      const clickedRect = {
        ...rect,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        x: rect.left,
        top: rect.top - elementScroll.top,
        y: rect.top - elementScroll.top,
      };

      const currentAlertIndex = nodesWithAlertsRef.current
        .slice(0, selectedNodeWithAlertsIndex + 1)
        .reduce(
          (acc, node, index, array) =>
            index === array.length - 1
              ? acc + selectedAlertIndex + 1
              : acc + node.alerts.length,
          0
        );

      popoverDataRef.current = {
        index: currentAlertIndex,
        totalAlerts: totalAlerts,
        alert: selectedAlert,
        position: clickedRect,
        node: nodeText,
        organizationConfig: authResponse?.organization_config,
      };
      renderPopover();
    }
  }, [selectedNodeWithAlertsIndex, selectedAlertIndex]);

  useEffect(() => {
    if (!checkEndpointCachedResponse) return;
    document.documentElement.setAttribute('witty-could-determine-lang', 'true');
    setRemoveHighlights(false);

    if (checkEndpointCachedResponse.checkEndpointResponse) {
      const checkEndpointResponse =
        checkEndpointCachedResponse.checkEndpointResponse;
      setConfigHasChanged(checkEndpointResponse.config_changed);
      checkEndpointResponse.notifications
        ? storeInLocalStorage(
            StorageKeys.NUMBER_OF_NOTIFICATIONS,
            checkEndpointResponse.notifications
          )
        : storeInLocalStorage(StorageKeys.NUMBER_OF_NOTIFICATIONS, 0);
    }

    setActiveIcon('active');
    setAlerts([...checkEndpointCachedResponse.alerts]);
    // console.log('NEWALERTS', checkEndpointCachedResponse.alerts);
  }, [checkEndpointCachedResponse]);

  useEffect(() => {
    if (alerts.length === 0) {
      setRemoveHighlights(true);
      setForceHighlightUpdate(!forceHighlightUpdate);
      return;
    }
    // The "ignored categories" mechanism is gone along with the upgrade prompt:
    // it existed so that dismissing the upsell nag suppressed that category for
    // a week. Nothing populated it other than that prompt.
    const alertsWithoutIgnoredCategories = alerts;

    const alertsWithoutIgnoredTerms: IAlert[] =
      alertsWithoutIgnoredCategories.filter(
        (alert: IAlert) => !ignoredTerms.includes(alert.data?.text)
      );

    //handle case where a word has multiple alerts of different gravity
    const whereMinGravity = (alert0: IAlert, ...alerts: IAlert[]): IAlert =>
      [alert0, ...alerts]
        .filter(Boolean)
        .reduce((minAlert, currentAlert) =>
          minAlert.data?.category === 'orthography' &&
          currentAlert.data?.category !== 'orthography'
            ? currentAlert
            : minAlert.data?.category !== 'orthography' &&
                currentAlert.data?.category === 'orthography'
              ? minAlert
              : minAlert.data.gravity === currentAlert.data.gravity
                ? minAlert
                : (minAlert.data.gravity || Infinity) <
                    (currentAlert.data.gravity || Infinity)
                  ? minAlert
                  : currentAlert
        );
    //Reduces the array to show only the alerts with a lower gravity (lower gravity === worst)
    const alertsWithoutIgnoredTermsGravityReduced = Object.values(
      alertsWithoutIgnoredTerms.reduce(
        (groups, alert) => {
          return {
            ...groups,
            [alert.startOffset]: whereMinGravity(
              alert,
              groups[alert.startOffset]
            ),
          };
        },
        {} as Record<number, IAlert>
      )
    ).sort((a, b) => a.startOffset - b.startOffset);

    const nodesWithAlertsTemp: INodeWithAlerts[] =
      isTextArea(element) || isInputText(element)
        ? [
            {
              node: clone.firstChild,
              alerts: alertsWithoutIgnoredTermsGravityReduced,
            },
          ]
        : getNodesWithRecalculatedPositionAlerts(
            alertsWithoutIgnoredTermsGravityReduced,
            isGoogleDocs()
              ? getActiveDocument().evaluate(
                  './/text()',
                  clone,
                  null,
                  XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                  null
                )
              : (elementXPathResult as XPathResult)
          );

    const nodesWithAlertsTempWithRect = nodesWithAlertsTemp.map(
      (nodeWithAlerts) => {
        const nodeWithAlertsWithRect = {
          ...nodeWithAlerts,
          alerts: nodeWithAlerts.alerts.map((alert) => {
            const range = getActiveDocument().createRange();

            if (
              !nodeWithAlerts.node ||
              alert.startOffset > nodeWithAlerts.node.length ||
              alert.endOffset > nodeWithAlerts.node.length ||
              alert.startOffset < 0 ||
              alert.endOffset < 0
            ) {
              return alert;
            }
            if (nodeWithAlerts.node.nodeType === Node.TEXT_NODE) {
              range.setStart(nodeWithAlerts.node, alert.startOffset);
              range.setEnd(nodeWithAlerts.node, alert.endOffset);
            } else {
              range.setStart(
                nodeWithAlerts.node.childNodes[0],
                alert.startOffset
              );
              range.setEnd(nodeWithAlerts.node.childNodes[0], alert.endOffset);
            }
            const rect = range.getClientRects()[0];
            if (!rect) return alert;
            return {
              ...alert,
              rect: {
                ...rect,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top - elementScroll.top, //+ elementScroll.top
              },
            };
          }),
        };
        return nodeWithAlertsWithRect;
      }
    );

    const nodesWithAlertWithoutIgnoredTerm = nodesWithAlertsRef.current
      .map((nodeWithAlerts) => {
        const alertsWithoutIgnoredTerms = nodeWithAlerts.alerts.filter(
          (alert: IAlert) => !ignoredTerms.includes(alert.data?.text)
        );
        return {
          ...nodeWithAlerts,
          alerts: alertsWithoutIgnoredTerms,
        };
      })
      .filter((nodeWithAlerts) => nodeWithAlerts.alerts.length > 0);

    const mergedNodesWithAlerts = [
      ...nodesWithAlertWithoutIgnoredTerm.filter(
        (nodeWithAlerts) =>
          !nodesWithAlertsTempWithRect
            .map((nodeWithAlerts) => nodeWithAlerts.nodeIndex)
            .includes(nodeWithAlerts.nodeIndex)
      ),
      ...nodesWithAlertsTempWithRect,
    ].sort((a: any, b: any) => a.nodeIndex - b.nodeIndex);

    const totalAlertsToSet: number = mergedNodesWithAlerts.reduce(
      (total, node) => total + node.alerts.length,
      0
    );
    setTotalAlerts(totalAlertsToSet);
    nodesWithAlertsRef.current = mergedNodesWithAlerts;
    // TODO Restore logNewCheckResponses

    const nodeStorageRefWithAlerts = nodesStorageRef.current.map(
      (node: INodes) => {
        const nodeWithAlerts = mergedNodesWithAlerts.find(
          (nodeWithAlerts: INodeWithAlerts) =>
            nodeWithAlerts.nodeIndex === node.index
        );
        return {
          ...node,
          alerts: nodeWithAlerts ? nodeWithAlerts.alerts : [],
        };
      }
    );

    prevCheckedNodesRef.current = [
      ...prevCheckedNodesRef.current.filter((prevCheckedNode: INodes) => {
        const nodeIndex = nodeStorageRefWithAlerts.findIndex(
          (node: INodes) => node.index === prevCheckedNode.index
        );
        return nodeIndex === -1;
      }),
      ...nodeStorageRefWithAlerts,
    ].sort((a: INodes, b: INodes) => a.index - b.index);
    nodesStorageRef.current = [];
    setForceHighlightUpdate(!forceHighlightUpdate);
  }, [alerts, ignoredTerms, elementXPathResult, selectedAlertIndex]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[],
    elementEvaluation: XPathResult
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];

    if (!isTextArea(element)) {
      let updatedAlerts: IAlert[] = [];
      const nodesForCalculation = getTextDividedByNodes(element)
        .map((node, index) => {
          const content = node.text;
          return {node: content as string, index, rawNode: node.node};
        })
        .filter((node: INodes) => node.node.length > 0)
        .sort((a: INodes, b: INodes) => a.index - b.index);

      let currentPosition = 0; // Keeps track of the current position as we loop

      nodesForCalculation.forEach((node) => {
        const absolutePositionOfFirstCharOfNode = currentPosition;

        // Get the current node's text length
        const text = node.node;
        const textLength = text.length;

        // Update the current position
        currentPosition += textLength;

        const absolutePositionOfLastCharOfNode = currentPosition;

        // Filter relevant alerts
        const alertsRelevantToNode = alerts.filter((alert: IAlert) =>
          text.includes(alert.data?.text)
        );

        updatedAlerts = alertsRelevantToNode
          .map((alert: IAlert) => {
            return {
              ...alert,
              startOffset:
                alert.startOffset - absolutePositionOfFirstCharOfNode,
              endOffset: alert.endOffset - absolutePositionOfFirstCharOfNode,
            };
          })
          .filter(
            (alert) =>
              alert.startOffset >= 0 &&
              alert.endOffset >= 0 &&
              alert.startOffset <=
                absolutePositionOfLastCharOfNode -
                  absolutePositionOfFirstCharOfNode &&
              alert.endOffset <=
                absolutePositionOfLastCharOfNode -
                  absolutePositionOfFirstCharOfNode
          );

        if (updatedAlerts.length > 0) {
          nodesWithAlertsTemp.push({
            node: node.rawNode, // Possibly null
            alerts: updatedAlerts,
            nodeIndex: node.index,
          });
        }
      });
    } else {
      //EVENTUALLY REFACTOR TO ONLY USE ABOVE CONDITION
      let textStartingAbsPosition = 0;
      let textEndAbsPosition = -1;

      const nodesForCalculation = getTextDividedByNodes(element).map(
        (node, index) => {
          return {node: node.text, index, rawNode: element};
        }
      );
      for (let index = 0; index < elementEvaluation.snapshotLength; index++) {
        const node = elementEvaluation.snapshotItem(index) as Node;
        if (node.nodeValue && node.nodeValue.match(/(\u00A0)|\S/i)) {
          if (
            //for handeling long text
            nodesForCalculation.length > 0 &&
            !nodesForCalculation.some(
              (nodeWithAlertsRef) => nodeWithAlertsRef.index === index
            )
          ) {
            continue;
          }

          textStartingAbsPosition = textEndAbsPosition + 1;
          textEndAbsPosition =
            nodesForCalculation.length == 0
              ? textStartingAbsPosition + node.nodeValue.length - 1 //needed to keep highlights in place
              : textStartingAbsPosition + node.nodeValue.length;

          if (nodesForCalculation.length == 0) {
            const nextText: string = isGoogleDocs()
              ? getInputText(cloneRef.current)
              : getInputText(element);
            if (nextText.charAt(textEndAbsPosition + 1).match(/\n/gi)) {
              textEndAbsPosition += 1;
            }
          }

          const alertsTemp: IAlert[] = alerts
            .filter(
              (alert: IAlert) =>
                node.nodeValue && node.nodeValue.includes(alert.data?.text)
            )
            .filter(
              (alert: IAlert) =>
                (alert.startOffset >= textStartingAbsPosition &&
                  alert.endOffset <= textEndAbsPosition) ||
                (isLinkedin() && alert.data?.text.includes('#'))
            )
            .map((alert: IAlert) => {
              return {
                ...alert,
                startOffset: alert.startOffset - textStartingAbsPosition,
                endOffset: alert.endOffset - textStartingAbsPosition,
              };
            });

          if (alertsTemp.length > 0)
            nodesWithAlertsTemp.push({
              node: node,
              alerts: alertsTemp,
              nodeIndex: index,
            });
        }
      }
    }
    return nodesWithAlertsTemp;
  };

  const updateTextWithAlternative = (alternative: string) => {
    const isRemoveAlternative = alternative === ' ';
    isRemoveAlternative && (alternative = '');
    alternative = alternative.replace(/\(\(/g, '[').replace(/\)\)/g, ']');
    const alert = selectedAlertRef.current as IAlert;

    let startOffset = alert.startOffset;
    let endOffset = alert.endOffset;

    if (!isRemoveAlternative) {
      const llmAlternative = getLLMSuggestions({
        alert,
      })?.data?.results?.get(alternative);
      if (llmAlternative) {
        alternative = llmAlternative;
        startOffset = alert.data.fullSentence.range[0];
        endOffset = alert.data.fullSentence.range[1];
      }
    }

    const node = popoverDataRef.current?.node as Node;
    const textLengthDifference = alternative.length - endOffset + startOffset;
    const alertsInParagraph = nodesWithAlertsRef.current.find(
      (nodeWithAlerts) => nodeWithAlerts.node === node
    )?.alerts;
    if (alertsInParagraph) {
      //update the start and end offset of alters that are after the alert that is being replaced
      alertsInParagraph.forEach((compareAlert) => {
        if (compareAlert.startOffset > startOffset) {
          compareAlert.startOffset += textLengthDifference;
          compareAlert.endOffset += textLengthDifference;
        }
      });
    }
    //remove the alert that is being replaced
    nodesWithAlertsRef.current = nodesWithAlertsRef.current.map(
      (nodeWithAlerts) => {
        if (nodeWithAlerts.node === node) {
          return {
            ...nodeWithAlerts,
            alerts: nodeWithAlerts.alerts.filter(
              (nodeAlert) => nodeAlert.id !== alert.id
            ),
          };
        }
        return nodeWithAlerts;
      }
    );

    if (isTextArea(element) || isInputText(element)) {
      element.selectionStart = startOffset - (isRemoveAlternative ? 1 : 0);
      element.selectionEnd = endOffset;
      //execCommand IS DEPRECATED, but its the only way to enable undo/redo for now
      getActiveDocument().execCommand('insertText', false, alternative);
    } else {
      const range = getActiveDocument().createRange();

      range.setStart(node, startOffset - (isRemoveAlternative ? 1 : 0));
      range.setEnd(node, endOffset);

      const sel = getActiveDocument().getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);

      if (isCkEditor(element)) {
        const deleteSelectedText = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        });
        node.dispatchEvent(deleteSelectedText);
        //Need to slow down the process for changes to be applied
        setTimeout(() => {
          const insertAlternative = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            cancelable: true,
            bubbles: true,
          });

          if (!insertAlternative.clipboardData) return;
          insertAlternative.clipboardData.setData('text/plain', alternative);
          node.dispatchEvent(insertAlternative);

          setTimeout(() => {
            checkText(getInputText(element));
            const event = new Event('keyup', {bubbles: true});
            element.dispatchEvent(event);
          }, 200);
        }, 200);
      } else if (isGoogleDocs()) {
        setActiveIcon('loading');
        setAlerts([]);

        const rects = range.getBoundingClientRect();
        const selectedTextStart = {
          clientX: rects.x,
          clientY: rects.y + rects.height / 2,
          bubbles: !0,
          shiftKey: !1,
        };
        (element.dispatchEvent(new MouseEvent('mousedown', selectedTextStart)),
          element.dispatchEvent(new MouseEvent('mouseup', selectedTextStart)));

        const selectedTextEnd = {
          clientX: rects.x + rects.width,
          clientY: rects.y + rects.height / 2,
          bubbles: !0,
          shiftKey: !0,
        };
        (element.dispatchEvent(new MouseEvent('mousedown', selectedTextEnd)),
          element.dispatchEvent(new MouseEvent('mouseup', selectedTextEnd)));

        //if empty insert space
        const replacementText = isRemoveAlternative ? '   ' : alternative;
        const replaceWithPaste = function (alternative: string) {
          const evt = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            cancelable: true,
            bubbles: true,
          });
          if (!evt.clipboardData) return;
          evt.clipboardData.items.add(alternative, 'text/plain');
          const eventTarget = (
            document.querySelector('.docs-texteventtarget-iframe') as any
          )?.contentDocument?.activeElement;
          eventTarget && eventTarget.dispatchEvent(evt);
        };
        if (navigator.userAgent.match(/firefox|fxios/i)) {
          const ownerDocument = element.ownerDocument;
          const script = ownerDocument.createElement('script');
          script.innerHTML = `(${replaceWithPaste})(${JSON.stringify(
            replacementText
          )})`;
          ownerDocument.head.appendChild(script);
          script?.parentNode
            ? script.parentNode?.removeChild(script)
            : script.remove();
        } else {
          replaceWithPaste(replacementText);
        }

        resetPopover();
      } else {
        if (isOutlook()) {
          //dispatch KeyboardEvent to enable undo/redo outlook
          const deleteSelectedText = new KeyboardEvent('keydown', {
            key: 'Delete',
            bubbles: true,
            cancelable: true,
          });
          node.dispatchEvent(deleteSelectedText);
        }

        getActiveDocument().execCommand('insertText', false, alternative);
      }
    }

    if (isTextArea(element)) {
      const unchangedAlerts = nodesWithAlertsRef.current.map((nodeWithAlerts) =>
        nodeWithAlerts.alerts.filter(
          (nodeAlert) => nodeAlert.startOffset < startOffset
        )
      );
      if (unchangedAlerts[0]) setAlerts(unchangedAlerts[0]);
    }
    if (!isCkEditor(element) && !isGoogleDocs()) {
      handleTextAndIcon(); //ensures update
      const event = new KeyboardEvent('keyup');
      handleKeyupEventDebounced(event);
      handleTextChanged();
    }
  };

  useEffect(() => {
    if (checkEndpointError?.status === 422) {
      document.documentElement.setAttribute(
        'witty-could-determine-lang',
        'false'
      );
      setAlerts([]);
    } else if (
      checkEndpointError?.status == 403 ||
      (authErrorResponse?.status === 403 && userIsSignedIn)
    ) {
      // Refresh via the OAuth2 refresh_token grant. This used to drive
      // useRefreshTokenEndpoint, which POSTed to the dashboard's
      // /api/refresh-token — a route deleted with Azure AD B2C, so the whole
      // path was dead. getNewAccessToken handles rotation and falls back to
      // logOut() when the refresh token is spent.
      getNewAccessToken()
        .then(() => {
          checkText('');
          checkText(currentTextToCheck);
        })
        .catch((error: unknown) => {
          sendErrorToSentry(error);
        });
    } else if (authErrorResponse?.status === 400 && window.top) {
      //400 means means min version not installed
      try {
        renderNotificationToTop('min_version_not_installed', element);
      } catch (error) {
        DEV_ENV && console.error('Error in renderNotification:', error);
      }
    }
    if (checkEndpointError || authErrorResponse) {
      log(
        `API Error Status Code ${checkEndpointError?.status}: ${checkEndpointError?.message}`,
        logTypes.ERROR
      );
    }
  }, [checkEndpointError, authErrorResponse]);

  const ErrorBoundaryFallback = () => (
    <Toast message={t('reloadWebsite')} type='error' />
  );

  const storageChange = (changes: any) => {
    const changedItems = Object.keys(changes);
    for (const item of changedItems) {
      switch (item) {
        case StorageKeys.SIGNED_IN:
          setUserIsSignedIn(changes[item].newValue);
          setConfigHasChanged(changes[item].newValue);
          checkText('');
          checkText(currentTextToCheck);
          break;
      }
    }
  };

  useEffect(() => {
    renderPopover();
  }, [LLMSuggestionsCache]);

  const renderPopover = () => {
    if (!popoverRootRef.current) {
      const existingPopoverElement = document.querySelector(WTags.WW_POPOVER);

      // If an existing popover element is not found, create a new one
      if (!existingPopoverElement) {
        const popoverElement = document.createElement(WTags.WW_POPOVER);
        document.body.appendChild(popoverElement);
        popoverRootRef.current = createRoot(popoverElement);
      } else {
        popoverRootRef.current = createRoot(existingPopoverElement);
      }
    }
    const container = document.querySelector(WTags.WW_POPOVER);
    if (!container) return;
    //Show/Hide the popover
    if (popoverDataRef.current && userIsSignedIn) {
      popoverRootRef.current?.render(
        <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
          <HighlightPopover
            element={element}
            data={popoverDataRef.current}
            prevData={previousPopoverDataRef.current}
            hide={resetPopover}
            updateTextWithAlternative={updateTextWithAlternative}
            addIgnoredTerm={addIgnoredTerm}
            movePopoverNextOrPrev={movePopoverNextOrPrev}
            setLLMSuggestionsRequest={setLLMSuggestionsRequest}
            getLLMSuggestions={getLLMSuggestions}
            focusOnOpen={openedViaKeyboardRef.current}
          />
        </Sentry.ErrorBoundary>
      );
    } else if (popoverDataRef.current && !userIsSignedIn) {
      popoverRootRef.current?.render(
        <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
          <HighlightPopoverNotSignedIn
            element={element}
            data={popoverDataRef.current}
            prevData={previousPopoverDataRef.current}
            hide={resetPopover}
            focusOnOpen={openedViaKeyboardRef.current}
          />
        </Sentry.ErrorBoundary>
      );
    } else {
      resetPopover();
    }
  };

  return (
    <>
      {isFocused && (
        <>
          {isTextArea(element) && (
            <WTags.WW_CLONE>
              <TextAreaClone
                element={element}
                elementRect={elementRect}
                elementScroll={elementScroll}
                updateClone={updateCloneData}
              />
            </WTags.WW_CLONE>
          )}
          {isInputText(element) && (
            <WTags.WW_CLONE>
              <InputTextClone
                element={element}
                elementRect={elementRect}
                updateClone={updateCloneData}
              />
            </WTags.WW_CLONE>
          )}
          {isGoogleDocs() && <WTags.WW_CLONE />}
          <WTags.WW_HIGHLIGHTS>
            <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
              <Highlights
                elementScroll={elementScroll}
                nodesWithAlerts={nodesWithAlertsRef.current}
                element={element}
                elementRect={elementRect}
                selectedAlert={
                  isTextArea(element)
                    ? selectedAlertRef.current
                    : popoverDataRef.current && popoverDataRef.current?.alert
                }
                removeHighlights={removeHighlights}
                forceHighlightUpdate={forceHighlightUpdate}
              />
            </Sentry.ErrorBoundary>
          </WTags.WW_HIGHLIGHTS>
        </>
      )}
      <WTags.WW_ACTIVITY_INDICATOR>
        <StateIndicatorIcon
          element={element}
          elementRect={elementRect}
          iconType={
            totalMaxCharLengthReachedRef.current ? 'warning' : activeIcon
          }
          isHovered={isHovered}
        />
      </WTags.WW_ACTIVITY_INDICATOR>
    </>
  );
};

export default Input;
