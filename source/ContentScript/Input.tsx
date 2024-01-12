import React, { useState, useEffect, useCallback } from 'react';
import { browser } from 'webextension-polyfill-ts';

import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import { WTags, StorageKeys, DEV_ENV } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
// import Notification from '../Notifications/Notification'; //Temporarily removed until we have a better solution
import TextAreaClone from './TextAreaClone';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import {
  CustomInputElement,
  IAlert,
  IExplanation,
  IgnoredCategory,
  INodes,
  INodeWithAlerts,
  Position,
} from '../shared/types';
import { storeInLocalStorage, logOut } from '../shared/utils';
import {
  isTextArea,
  isInputText,
  isCkEditor,
  isGoogleDocs,
  isLinkedin,
  isNotion,
} from '../shared/DOMutils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useMutationObserver } from '../shared/customHooks/useMutationObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { debounce } from 'lodash';
import HighlightPopover, {
  PopoverData,
} from './HighlightPopover/HighlightPopover';
import InputTextClone from './InputTextClone';
import Highlights from './Highlights';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';
import { useRefreshTokenEndpoint } from '../shared/ApiServices/useRefreshTokenEndpoint';
import Toast from '../shared/components/Toast/Toast';
import { sendErrorToSentry } from '../shared/errorUtils';
import { useAuthEndpoint } from '../shared/ApiServices/useAuthEndpoint';
import { setToken } from '../shared/ApiServices/requests';
import GoogleDocsClone from './GoogleDocsClone';
import {
  getFirstTextDiff,
  getInputText,
  getNodesWithinMaxCharLength,
  getScrollParent,
  getTextDividedByNodes,
  shouldReturnEarly,
  updateConfig,
} from './utils';
import { getActiveDocument } from './ContentScriptApp';
import HighlightPopoverNotSignedIn from './HighlightPopover/HighlightPopoverNotSignedIn';
import HighlightPopoverUpgrade from './HighlightPopover/HighlightPopoverUpgrade';
import Notification from '../Notifications/Notification';

const Input: React.FC<{
  element: CustomInputElement;
}> = ({ element }) => {
  const [checkEndpointResponse, checkEndpointError, setTextToCheck] =
    useCheckEndpoint();
  const [authResponse, authErrorResponse, setConfigHasChanged] =
    useAuthEndpoint();
  const [, , previousElementStateRef] = useStateRef<{
    text: string[] | string;
    position: DOMRect;
  }>({ text: [], position: {} as DOMRect });

  const [, , nodesWhithinMaxCharLengthRef] = useStateRef<
    { node: string; index: number; rawNode: Node }[]
  >([]);
  const [refreshTokenResponse, refreshTokenError, setRefreshToken] =
    useRefreshTokenEndpoint();
  const [currentTextToCheck, setCurrentTextToCheck] = useState('');
  const analytics = useAnalytics();
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
  const [nodesWithAlerts, setNodesWithAlerts, nodesWithAlertsRef] = useStateRef(
    [] as INodeWithAlerts[]
  );
  const [, , prevCheckedNodesRef] = useStateRef([] as INodes[]);
  const [, , nodesStorageRef] = useStateRef([] as INodes[]);
  const [selectedNodeWithAlertsIndex, setSelectedNodeWithAlertsIndex] =
    useState<number>(-1);
  const [selectedAlertIndex, setSelectedAlertIndex, prevSelectedAlertIndex] =
    useStateRef<number>(-1);
  const [selectedAlert, setSelectedAlert] = useState<IAlert | null>(null);
  const [popoverData, setPopoverData] = useState<PopoverData | null>(null);
  const [, , previousPopoverDataRef] = useStateRef<PopoverData | null>(null);
  const [activeIcon, setActiveIcon, activeIconRef] = useStateRef('active');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [elementXPathResult, setElementXPathResult] = useState<XPathResult>();
  const [debounceDelay, setDebounceDelay] = useState<number>(defaultConfig.API_DELAY);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [ignoredCategoriesFromStorage, setIgnoredCategoriesFromStorage] =
    useState<IgnoredCategory[]>([]);
  const [userIsSignedIn, setUserIsSignedIn] = useState<boolean>(false);
  const minCharLength = defaultConfig.MIN_CHAR_LENGTH;
  const totalMaxCharLength = defaultConfig.MAX_CHAR_LENGTH_TOTAL_FREEMIUM;
  const [, , totalMaxCharLengthReachedRef] = useStateRef<boolean>(false);
  const [, , firstScrollableParentRef] = useStateRef<HTMLElement>(element);
  const [, , previouslyCheckedPagesGoogleDocs] = useStateRef<number[]>([]);
  const [unchangedAlertsTextarea, setUnchangedAlertsTextarea] = useState<
    IAlert[]
  >([]);
  const [, , previousScrollTopRef] = useStateRef<number>(0);
  const [, , checkLogEventIdRef] = useStateRef<string>('');
  const [, , isWittyPremiumUserRef] = useStateRef<boolean>(true); //Toggle to easily test char limit logic (should be true in prod)
  const maxCharLength = isWittyPremiumUserRef.current ? defaultConfig.MAX_CHAR_LENGTH_REQUEST_PREMIUM : defaultConfig.MAX_CHAR_LENGTH_REQUEST_FREEMIUM;
  const googleDocsEventTarget = (
    document.querySelector('.docs-texteventtarget-iframe') as any
  )?.contentDocument.activeElement;
  const onElementMutation = useCallback(
    (mutationsList: MutationRecord[]) => {
      if (isGoogleDocs()) {
        setIsActive(true);
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
    const cloneContainer = document.querySelector(WTags.WW_CLONE);
    if (!cloneContainer) return;
    //if no text, remove highlights
    if (!element.querySelector('g')) {
      setAlerts([]);
    }
    setTextToCheck('');
    ReactDOM.render(
      <GoogleDocsClone
        element={element}
        previousElement={previousElementStateRef.current}
        updateClone={updateCloneData}
      />,
      document.querySelector(WTags.WW_CLONE)
    );
    setIsActive(false);
    setActiveIcon('active');

    //Deals with new pages getting rendered in google docs
    const pages = element.querySelectorAll('.kix-page-paginated');
    const pagesZIndex = Array.from(pages).map((page) => {//z-index = page number
      const zIndex = window    
        .getComputedStyle(page)
        .getPropertyValue('z-index');
      return parseInt(zIndex);
    }) as number[];
    if (!pagesZIndex.every((page) => previouslyCheckedPagesGoogleDocs.current.includes(page)) && isGoogleDocs()) {
      previouslyCheckedPagesGoogleDocs.current = [
        ...new Set([...previouslyCheckedPagesGoogleDocs.current, ...pagesZIndex]),
      ];
    }
  }, 500);

  useMutationObserver(element, onElementMutation);
  const { t } = useTranslation([namespaces.errors]);
  const log = useLog('Input');

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setUserIsSignedIn(!!result[StorageKeys.ACCESS_TOKEN]);
        (result[StorageKeys.PLAN] === 'witty_free' || !result[StorageKeys.PLAN]) && (isWittyPremiumUserRef.current = false);
        setDebounceDelay(isWittyPremiumUserRef.current ? defaultConfig.API_DELAY : defaultConfig.API_DELAY_FREEMIUM);
        if (
          result[StorageKeys.PLAN] === 'witty_free' &&
          result[StorageKeys.IGNORED_CATEGORIES]
        ) {
          const filteredIgnoredCategories = (
            result[StorageKeys.IGNORED_CATEGORIES] as IgnoredCategory[]
          ).filter((term) => {
            const now = new Date();
            const termDate = new Date(term.timestamp);
            const diffTime = Math.abs(now.getTime() - termDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays < 7;
          });
          setIgnoredCategoriesFromStorage(filteredIgnoredCategories);
        }
      })
      .catch((error: unknown) => {
        sendErrorToSentry(error);
      });

    browser.storage.onChanged.addListener(storageChange);
    const scrollParent = getScrollParent(element);
    const newScrollableParent = (!isTextArea(element) && scrollParent) ? scrollParent : element;
    if (newScrollableParent)
      firstScrollableParentRef.current = newScrollableParent;

    if(!isGoogleDocs()) {
      element.addEventListener('focusout', handleFocusoutEvent);
      element.addEventListener('focusin', handleFocusinEvent);
    }
    element.addEventListener('mouseover', handleMouseoverEvent);
    element.addEventListener('mouseout', handleMouseoutEvent);
    newScrollableParent.addEventListener('scroll', handleElementScrollEvent);

    element.addEventListener('dblclick', handleElementClickEvent as any);
    element.addEventListener('click', handleElementClickEvent as any);

    if (isGoogleDocs()) {
      googleDocsEventTarget.addEventListener('focusout', handleFocusoutEvent);
      document.addEventListener(
        'click',
        handleDocumentClickEvent as EventListener
      );
      document.addEventListener('scroll', handleElementScrollEvent);
      window.addEventListener('resize', handleDocumentResizeEvent);
    }

    //If a parent form exists, we will monitor the submision.
    //This will allow us remove remaining highlights when text disappear
    const parentForm: HTMLFormElement | null = isTextArea(element)
      ? element.form
      : element.closest('form');

    if (parentForm)
      parentForm.addEventListener('submit', handleSubmitFormEvent);

    return () => {
      //Don't forget to remove the listeners at the end
      if(!isGoogleDocs()) {
        element.removeEventListener('focusout', handleFocusoutEvent);
        element.removeEventListener('focusin', handleFocusinEvent);
      }

      newScrollableParent.removeEventListener(
        'scroll',
        handleElementScrollEvent
      );

      element.removeEventListener('dblclick', handleElementClickEvent as any);
      element.removeEventListener('click', handleElementClickEvent as any);

      if (isGoogleDocs()) {
        googleDocsEventTarget.removeEventListener(
          'focusout',
          handleFocusoutEvent
        );
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
      const alertsInRange = [] as IAlert[];
      let selectedNode = {} as INodeWithAlerts;
      const googleDocsElementCursorRect = activeDocument
        .getElementById('kix-current-user-cursor-caret')
        ?.getBoundingClientRect();

      const updatedNodesWithAlerts = nodesWithAlertsRef.current.map(
        (nodeWithAlerts) => {
          const nodeWithAlertsRefWithUpdatedRects = {
            ...nodeWithAlerts,
            alerts: nodeWithAlerts.alerts.map((alert) => {
              const range = activeDocument.createRange();
              if (
                alert.startOffset > nodeWithAlerts.node.length ||
                alert.endOffset > nodeWithAlerts.node.length ||
                alert.startOffset < 0 ||
                alert.endOffset < 0
              ) {
                return alert;
              }
              range.setStart(nodeWithAlerts.node, alert.startOffset);
              range.setEnd(nodeWithAlerts.node, alert.endOffset);
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

      const newSelectedAlertIndex =
        updatedNodesWithAlerts[newSelectedNodeWithAlertsIndex]?.alerts.findIndex(
          (alert) => alert === selectedAlert
        );

      //LONG TEXT CLICK
      if (
        getInputText(cloneRef.current).length > maxCharLength &&
        (newSelectedAlertIndex < 0 || newSelectedAlertIndex === undefined) &&
        !totalMaxCharLengthReachedRef.current
      ) {
        const clickedElement = [] as ChildNode[];
        if (!cloneRef.current?.childNodes) {
          return;
        }

        const sortedChildNodes = Array.from(cloneRef.current.childNodes).sort(
          (a, b) => {
            const aRect = (a as HTMLElement).getBoundingClientRect();
            const bRect = (b as HTMLElement).getBoundingClientRect();
            return aRect.top - bRect.top;
          }
        );
        //get which cloneRef.current is under googleDocsElementCursorRect
        sortedChildNodes.forEach((clone) => {
          const htmlClone = clone as HTMLElement;
          const cloneRect = htmlClone.getBoundingClientRect();
          if (
            googleDocsElementCursorRect &&
            googleDocsElementCursorRect.top >= cloneRect.top &&
            googleDocsElementCursorRect.left >= cloneRect.left
          ) {
            clickedElement.push(clone);
          }
        });

        const clickedElementIndex = Array.from(
          cloneRef.current.childNodes
        ).findIndex(
          (clone) => clone === clickedElement[clickedElement.length - 1]
        );

        if (clickedElementIndex < 0) return;
        //long text and clicked node is outside of current nodes
        const caret: { position: number; element: Node } = {
          position: clickedElementIndex,
          element: cloneRef.current,
        };
        handleElementClickLongText(caret);
      }
      setSelectedNodeWithAlertsIndex(newSelectedNodeWithAlertsIndex);
      setSelectedAlertIndex(newSelectedAlertIndex);
    }
  };

  useEffect(() => {
    const event = new KeyboardEvent('keyup');
    handleKeyupEvent(event);

   if (isNotion()) {
      document
        .querySelector('.notion-frame')
        ?.addEventListener('keyup', handleKeyupEvent as any)
    } else {
      element.addEventListener('keyup', handleKeyupEvent as any);
    }
    element.addEventListener('paste', handleKeyupEvent as any);


    return () => {
      //Don't forget to remove the listeners at the end
      if (isNotion()) {
        document
          .querySelector('.notion-frame')
          ?.removeEventListener('keyup', handleKeyupEvent as any);
      } else {
        element.removeEventListener('keyup', handleKeyupEvent as any);
      }
      element.removeEventListener('paste', handleKeyupEvent as any);
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

  const handleFocusoutEvent = () => {
    setActiveIcon('passive');
    setAlerts([]);
    setTextToCheck('');
  };

  const handleFocusinEvent = () => {
    setActiveIcon('active');
  };

  const handleDocumentResizeEvent = () => {
    setAlerts([]);
    debouncedMutation();
  };

  const handleKeyupEvent = debounce((keyboardEvent: KeyboardEvent, gDocs?: boolean) => {
    if (prevSelectedAlertIndex.current != -1 && !gDocs) resetPopover();

    !isGoogleDocs() &&
      browser.storage.local
        .get(StorageKeys.ORTHOGRAPHY)
        .then((result) => {
          element.spellcheck = !result[StorageKeys.ORTHOGRAPHY];
        })
        .catch((error: unknown) => {
          sendErrorToSentry(error);
        });
    let nextText: string = isGoogleDocs()
      ? getInputText(cloneRef.current)
      : getInputText(element);

    const nextTextDividedByNodes = getTextDividedByNodes(element);

    const isSpecialKey = !keyboardEvent?.key || keyboardEvent.key === 'z' || keyboardEvent.key === 'Meta';
  if (!isSpecialKey && shouldReturnEarly(prevCheckedNodesRef.current, nextTextDividedByNodes)) {
    return;
  }

    const textDividedByNodesTextContent = isTextArea(element)
      ? nextText
      : (nextTextDividedByNodes.map((node) => node.textContent) as string[]);

    const fistTextDiff = getFirstTextDiff(
      element,
      textDividedByNodesTextContent,
      previousElementStateRef.current?.text
    );
    previousElementStateRef.current = {
      text: textDividedByNodesTextContent,
      position: element.getBoundingClientRect(),
    };
    if (isTextArea(element) && fistTextDiff) {
      const unchangedAlerts = nodesWithAlertsRef.current.map((nodeWithAlerts) =>
        nodeWithAlerts.alerts.filter(
          (alert) => alert.startOffset < fistTextDiff.position
        )
      );
      unchangedAlerts[0] && setAlerts(unchangedAlerts[0]);
      setUnchangedAlertsTextarea(unchangedAlerts[0]);
      handleTextAndIcon([nextText]);
    } else {
      !isGoogleDocs() && setAlerts([]);
      const nodeAtFirstTextDiff =
        nextTextDividedByNodes[fistTextDiff && !totalMaxCharLengthReachedRef.current ? fistTextDiff.node : 0];

      const nodesWithinMaxCharLength = getTextWithinMaxCharLength(
        fistTextDiff && !totalMaxCharLengthReachedRef.current ? fistTextDiff.node : 0,
        nodeAtFirstTextDiff
      );
      nodesWithinMaxCharLength &&
        handleTextAndIcon(
          nodesWithinMaxCharLength
        );
    }
  }, 500);

  const getTextWithinMaxCharLength = (
    currentNode: number,
    currentNodeRaw?: Node | null
  ) => {
    if (!currentNodeRaw) return;
    const textDividedByNodes = getTextDividedByNodes(element);
    const textDividedByNodesTextContent = textDividedByNodes.map(
      (node) => node.textContent
    );
    const currentText = textDividedByNodesTextContent[currentNode];
    if (!currentText) return;
    const charLengthLeft = maxCharLength - currentText.length;
    const nodesWhithinMaxCharLengthBelowNode = getNodesWithinMaxCharLength(
      'below',
      textDividedByNodes,
      currentNode,
      charLengthLeft
    );
    const nodesWhithinMaxCharLengthAboveNode = getNodesWithinMaxCharLength(
      'above',
      textDividedByNodes,
      currentNode,
      charLengthLeft
    );

    const currentNodeFormatted = [
      {
        node: currentNodeRaw.textContent as string,
        index: currentNode,
        rawNode: currentNodeRaw,
      },
    ];

    const nodesWhithinMaxCharLength = nodesWhithinMaxCharLengthAboveNode
      .concat(nodesWhithinMaxCharLengthBelowNode)
      .concat(currentNodeFormatted)
      .sort((a, b) => a.index - b.index)
      .filter(
        (node, index, self) =>
          index === self.findIndex((t) => t.index === node.index)
      );

    if (currentText.length > maxCharLength) {
      const shortenedText = currentText.slice(0, maxCharLength);
      nodesWhithinMaxCharLengthRef.current = [
        {
          node: shortenedText,
          index: currentNode,
          rawNode: currentNodeRaw,
        },
      ];
      return nodesWhithinMaxCharLength;
    } else {
      nodesWhithinMaxCharLengthRef.current = nodesWhithinMaxCharLength;
      return nodesWhithinMaxCharLength;
    }
  };

  const handleTextAndIcon = (nodes: any) => {
    const isTextAreaCheck = isTextArea(element);
    const clonedElement = document.querySelector(WTags.WW_CLONE)?.textContent;
    const allNodes = getTextDividedByNodes(element).map((node: any) => node.textContent);
    const totalTextLength = isTextAreaCheck && clonedElement ? clonedElement?.length : allNodes.join('').length;
    if (totalTextLength < maxCharLength) { //for short text ONLY!
      // localStorage.setItem(StorageKeys.TOTAL_MAX_CHAR_LENGTH_NOTIFICATION_SHOWED, 'false');
      // prevCheckedNodesRef.current = []; //prevents displaced highlights when text is short -> makes flickering long text (improve condition)
      setRemoveHighlights(true); //cause of flickering highlights when typing
    }
    let nodesToCheck = nodes; //not needed anymore as whatever is passed to handleTextAndIcon is already within max char length
    nodesStorageRef.current = nodesToCheck;
    let newTextToCheck = isTextAreaCheck ? nodes : nodesToCheck.map((node: any) => node.node).join('\n');
    if (isTextAreaCheck && totalTextLength > totalMaxCharLength && !isWittyPremiumUserRef.current) {
      totalMaxCharLengthReachedRef.current = true;
      // userIsSignedIn && analytics.maxCharLengthReachedLog('max_char_length_reached'); //TEMP removed to save events
      if (nodes[0] && typeof nodes[0] === 'string') {
        const lastSpaceIndex = nodes[0].lastIndexOf('', totalMaxCharLength);
        newTextToCheck = nodes[0].slice(0, lastSpaceIndex);
      }
    } else if (!isTextAreaCheck && totalTextLength > totalMaxCharLength && !isWittyPremiumUserRef.current) {
      totalMaxCharLengthReachedRef.current = true;
      // userIsSignedIn && analytics.maxCharLengthReachedLog('max_char_length_reached');//TEMP removed to save events
    } else {
      isTextAreaCheck && (newTextToCheck = nodes[0]); 
      totalMaxCharLengthReachedRef.current = false;
    }
    
    //if text length of node is smaller than MIN_CHAR_LENGTH length, add nodes until min char length is reached
    if (!isTextAreaCheck && newTextToCheck.length < minCharLength && newTextToCheck.length !== 0) {
      nodesToCheck = getNodesToFillMinCharLength(nodesToCheck, nodes);
      newTextToCheck = nodesToCheck.map((node: any) => node.node).join('\n');
      nodesStorageRef.current = nodesToCheck;
    }

    if (nodesToCheck.length > 0) { 
      const nodesWithAlertsWithoutChangesAlerts = nodesWithAlertsRef.current.filter(
        (nodeWithAlerts) => {
          const nodeIndex = nodesToCheck.findIndex(
            (nodeToCheck: { node: any; index: number | undefined }) => 
              nodeToCheck.index === nodeWithAlerts.nodeIndex 
            ); 
          return nodeIndex === -1;
        }
      );
      setNodesWithAlerts(nodesWithAlertsWithoutChangesAlerts);
    } 
    setCurrentTextToCheck(newTextToCheck); //for check call after refresh token

    if (typeof newTextToCheck !== 'string' || newTextToCheck.length === 0 || !newTextToCheck.match(/[a-zA-Z0-9.:;,?!]/i)) {
      setActiveIcon('active');
      setAlerts([]);
      setTextToCheck('');
    } else {
      debouncedSetTextToCheck(newTextToCheck);
      setActiveIcon('loading');
    }
  }

  const getNodesToFillMinCharLength = (nodesToCheck: any, nodes: any) => {
    if (nodesToCheck.length === 0) return nodesToCheck;

    const lowestNodeIndex = nodesToCheck.reduce(
      (prev: { index: number }, current: { index: number }) =>
        prev.index < current.index ? prev : current
    ).index;

    const nodesBeforeLowestNodeIndex = nodes
      .filter((node: INodes) => node.index < lowestNodeIndex)
      .sort((a: INodes, b: INodes) => b.index - a.index);

    let newNodesToCheck = nodesToCheck;

    let totalLength = nodesToCheck.reduce(
      (prev: number, current: { node: string }) => prev + current.node?.length || 0,
      0
    );
    while (totalLength < minCharLength) {
      const nodeToAdd = nodesBeforeLowestNodeIndex.shift();
      if (!nodeToAdd) break;
      newNodesToCheck = [...newNodesToCheck, nodeToAdd];
      totalLength += nodeToAdd.node.length;
    }
    newNodesToCheck.sort((a: INodes, b: INodes) => a.index - b.index);

    return newNodesToCheck;
  };

  const debouncedSetTextToCheck = debounce((text: string) => {
    //In this case always create a new string to force change the state of setTextToCheck
    setTextToCheck(text);
  }, debounceDelay);

  const handleElementScrollEvent = () => {
    if (!isTextArea(element) && previousScrollTopRef.current !== firstScrollableParentRef.current.scrollTop) {
      previousScrollTopRef.current = firstScrollableParentRef.current.scrollTop;
      setIsActive(true);
      setActiveIcon('loading');
      debouncedScroll();
    } 

    !isGoogleDocs() && setElementScroll({
        top: isTextArea(element) ? element.scrollTop : 0,
        left: isTextArea(element) ? element.scrollLeft : firstScrollableParentRef.current.scrollLeft,
      });
  };

  const debouncedScroll = debounce(() => {
    setIsActive(false);
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
      handleKeyupEvent(event);
    }
  };

  const resetPopover = () => {
    event?.stopPropagation();
    popoverData !== null && (previousPopoverDataRef.current = popoverData);
    setPopoverData(null);
    setSelectedAlert(null);
    setSelectedAlertIndex(-1);
  };

  const addIgnoredTerm = (term: string): void => {
    setIgnoredTerms([...ignoredTerms, term]);
  };

  const addIgnoredCategory = (
    gravity: number,
    explanation: IExplanation
  ): void => {
    let category = 'inclusive';
    if (gravity && !explanation) {
      category = 'premiumFeature';
    }
    const currentTime = new Date().getTime();
    const newIgnoredCategory: IgnoredCategory = {
      category: category,
      timestamp: currentTime,
    };

    const newIgnoredCategories: IgnoredCategory[] = [
      ...ignoredCategoriesFromStorage,
      newIgnoredCategory,
    ];
    storeInLocalStorage(StorageKeys.IGNORED_CATEGORIES, newIgnoredCategories);
    setIgnoredCategoriesFromStorage(newIgnoredCategories);
  };

  const handleElementClickEvent = debounce((event: MouseEvent) => {    
    const target = event.target as CustomInputElement;

    // Get caret data
    const caret: { position: number | null; element: Node | null } =
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
    if (caret.element && caret.position && caret.position > -1) {
      // Find out if the clicked element has alerts
      const selectedNodeWithAlertsIndex: number =
      nodesWithAlertsRef.current.findIndex(
        (nodeWithAlerts: INodeWithAlerts) =>
          isTextArea(target) || isInputText(target)
            ? nodeWithAlerts.node.parentNode === caret.element
            : nodeWithAlerts.node === caret.element
      );
      setSelectedNodeWithAlertsIndex(selectedNodeWithAlertsIndex);

      const oneNodeWithAlerts =
        nodesWithAlertsRef.current[selectedNodeWithAlertsIndex];
      if (oneNodeWithAlerts) {
        const caretPos = caret.position;

        let selectedAlertIndex =
          oneNodeWithAlerts?.alerts.findIndex((alert: IAlert) => {
            if (!alert) {
              return false;
            }

            return alert.startOffset <= caretPos && alert.endOffset >= caretPos
          });

        const selectedAlerts = oneNodeWithAlerts.alerts.filter(
          (alert: IAlert) =>
            alert.startOffset <= caretPos && alert.endOffset >= caretPos
        );

        if (
          getInputText(element).length > maxCharLength &&
          !isTextArea(element) &&
          selectedAlerts.length == 0 &&
          !isGoogleDocs() && 
          !totalMaxCharLengthReachedRef.current
        ) {
          handleElementClickLongText(caret);
        }

        if (selectedAlerts.length > 1) {
          const alertWithLargestStartoffset = selectedAlerts.reduce(
            (prev: IAlert, current: IAlert) => {
              return prev.startOffset > current.startOffset ? prev : current;
            }
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
      } else if (
        getInputText(element).length > maxCharLength &&
        !isTextArea(element) &&
        !isGoogleDocs() &&
        !totalMaxCharLengthReachedRef.current
      ) {
        handleElementClickLongText(caret);
      }
    }
  }, 200);

  const handleElementClickLongText = (caret: {
    position: number | null;
    element: Node | null;
  }): void => {
    setAlerts([]);
    setTextToCheck('');
    if (isGoogleDocs() && caret.position) {      
      const nodeIsChecked = prevCheckedNodesRef.current.find((prevCheckedNode) =>
        prevCheckedNode.rawNode === cloneRef.current?.childNodes[caret.position as number]
      );
      if (nodeIsChecked) return;
      const textWithinMaxCharLength = getTextWithinMaxCharLength(
        caret.position,
        cloneRef.current?.childNodes[caret.position]
      );
      if (!textWithinMaxCharLength) return;
      handleTextAndIcon(textWithinMaxCharLength)
    } else if (!isGoogleDocs() && caret.element) {
      const textDividedByNodes = getTextDividedByNodes(element);
      const clickedNodeAlreadyChecked = prevCheckedNodesRef.current.find(
        (prevCheckedNode) => prevCheckedNode.rawNode === caret.element
      );
      if (clickedNodeAlreadyChecked) return;

      const textWithinMaxCharLength = getTextWithinMaxCharLength(
        textDividedByNodes.indexOf(caret.element),
          caret.element
        );
        if (!textWithinMaxCharLength) return;
        handleTextAndIcon(textWithinMaxCharLength);
    }
  };

  const movePopoverNextOrPrev = (direction: string): void => {
    if (direction === 'previous') {
      if (selectedAlertIndex === 0) {
        setSelectedNodeWithAlertsIndex(selectedNodeWithAlertsIndex - 1);
        setSelectedAlertIndex(
          nodesWithAlertsRef.current[selectedNodeWithAlertsIndex - 1].alerts
            .length - 1
        );
        event?.stopPropagation();
      } else {
        setSelectedAlertIndex(selectedAlertIndex - 1);
        event?.stopPropagation();
      }
    } else {
      if (
        selectedAlertIndex ===
        nodesWithAlertsRef.current[selectedNodeWithAlertsIndex].alerts.length -
          1
      ) {
        setSelectedNodeWithAlertsIndex(selectedNodeWithAlertsIndex + 1);
        setSelectedAlertIndex(0);
        event?.stopPropagation();
      } else {
        setSelectedAlertIndex(selectedAlertIndex + 1);
        event?.stopPropagation();
      }
    }
  };

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
      setSelectedAlert(selectedAlert);

      const range = getActiveDocument().createRange();
      const nodeText = oneNodeWithAlerts.node;

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

      setPopoverData({
        index: currentAlertIndex,
        totalAlerts: totalAlerts,
        alert: selectedAlert,
        position: clickedRect,
        node: nodeText,
      });
    }
  }, [selectedNodeWithAlertsIndex, selectedAlertIndex]);

  useEffect(() => {
    if (!checkEndpointResponse) return;
    document.documentElement.setAttribute('witty-could-determine-lang', 'true');
    setRemoveHighlights(false);
    setConfigHasChanged(checkEndpointResponse.config_changed ? true : false);

    checkEndpointResponse.notifications
      ? storeInLocalStorage(
          StorageKeys.NUMBER_OF_NOTIFICATIONS,
          checkEndpointResponse.notifications
        )
      : storeInLocalStorage(StorageKeys.NUMBER_OF_NOTIFICATIONS, 0);

    setActiveIcon('active');
    checkLogEventIdRef.current = Math.random().toString(36).substring(2, 15);
    userIsSignedIn && analytics.checkLog(
      checkEndpointResponse,
      authResponse,
      clone?.firstChild?.textContent ? clone?.firstChild.textContent.length : 0,
      'check',
      checkLogEventIdRef.current
    );
  
    log(
      `Results: Language is ${checkEndpointResponse.language.toUpperCase()} and the relevant terms are: `,
      logTypes.INFO,
      checkEndpointResponse.results.length > 0
        ? checkEndpointResponse.results
        : 'None'
    );

    const alerts: IAlert[] = checkEndpointResponse.results
      .map((result) => ({
        id: `${result.text}-${result.category}-${result.start}${result.end}`,
        startOffset: result.start,
        endOffset: result.end,
        popOverIsOpen: false,
        organizationId: authResponse ? authResponse.organization_id : undefined,
        userId: authResponse ? authResponse.id : undefined,
        plan: authResponse ? authResponse.plan : undefined,
        data: {
          language: checkEndpointResponse.language,
          category: result.category,
          subcategory: result.subcategory,
          context: result.context,
          text: result.text,
          label: result.label,
          explanation: result.explanation,
          alternatives: result.alternatives,
          gravity: result.gravity,
        },
      }))
      .sort((firstAlert, secondAlert) => {
        return firstAlert.startOffset < secondAlert.startOffset ? -1 : 1;
      });

    setAlerts([...alerts]);
  }, [checkEndpointResponse]);

  useEffect(() => {

    if (alerts.length === 0) {
      setRemoveHighlights(true);
      setForceHighlightUpdate(!forceHighlightUpdate);
      return;
    } 
      let alertsWithoutIgnoredCategories = alerts;

      //if any item in ignoredCategoriesFromStorage has the category 'inclusive', remove checkEndpointResponse.results that have the category 'inclusive'
      if (
        ignoredCategoriesFromStorage
          .map((item) => item.category)
          .includes('inclusive')
      ) {
        alertsWithoutIgnoredCategories = alertsWithoutIgnoredCategories.filter(
          (alert) => alert.data.gravity !== undefined
        );
      }

      if (
        ignoredCategoriesFromStorage
          .map((item) => item.category)
          .includes('premiumFeature')
      ) {
        alertsWithoutIgnoredCategories = alertsWithoutIgnoredCategories.filter(
          (alert) => alert.data.explanation !== undefined
        );
      }

      const alertsWithoutIgnoredTerms: IAlert[] =
        alertsWithoutIgnoredCategories.filter(
          (alert: IAlert) => !ignoredTerms.includes(alert.data?.text)
        );

      //handle case where a word has multiple alerts of different gravity
      const whereMinGravity = (alert0: IAlert, ...alerts: IAlert[]): IAlert => {
        return [alert0, ...alerts]
          .filter(Boolean)
          .reduce((minAlert, currentAlert) =>
            minAlert.data.category === 'orthography' &&
            currentAlert.data.category !== 'orthography'
              ? currentAlert
              : minAlert.data.category !== 'orthography' &&
                currentAlert.data.category === 'orthography'
              ? minAlert
              : minAlert.data.gravity === currentAlert.data.gravity
              ? minAlert
              : (minAlert.data.gravity || Infinity) <
                (currentAlert.data.gravity || Infinity)
              ? minAlert
              : currentAlert
          );
      };
      //Reduces the array to show only the alerts with a lower gravity (lower gravity === worst)
      const alertsWithoutIgnoredTermsGravityReduced = Object.values(
        alertsWithoutIgnoredTerms.reduce(
          (groups, alert) => ({
            ...groups,
            [alert.startOffset]: whereMinGravity(
              alert,
              groups[alert.startOffset]
            ),
          }),
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
              range.setStart(nodeWithAlerts.node, alert.startOffset);
              range.setEnd(nodeWithAlerts.node, alert.endOffset);
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

      const nodesWithAlertWithoutIgnoredTerm = nodesWithAlertsRef.current.map((nodeWithAlerts) => {
        const alertsWithoutIgnoredTerms = nodeWithAlerts.alerts.filter((alert: IAlert) => {
          return !ignoredTerms.includes(alert.data?.text);
        });
        return {
          ...nodeWithAlerts,
          alerts: alertsWithoutIgnoredTerms,
        }
      }).filter((nodeWithAlerts) => {
        return nodeWithAlerts.alerts.length > 0;
      });

      const mergedNodesWithAlerts = [
        ...nodesWithAlertWithoutIgnoredTerm.filter(
          (nodeWithAlerts) =>
            !nodesWithAlertsTempWithRect
              .map((nodeWithAlerts) => nodeWithAlerts.nodeIndex)
              .includes(nodeWithAlerts.nodeIndex)
        ),
        ...nodesWithAlertsTempWithRect,
      ].sort((a: any, b: any) => a.nodeIndex - b.nodeIndex);      

      const totalAlerts: number = mergedNodesWithAlerts.reduce(
        (total, node) => total + node.alerts.length,
        0
      );
      setTotalAlerts(totalAlerts);
      setNodesWithAlerts(mergedNodesWithAlerts);
      isWittyPremiumUserRef.current && userIsSignedIn && DEV_ENV && logNewCheckResponses(mergedNodesWithAlerts,  prevCheckedNodesRef.current);//TEMP: only log check_highlights in dev_env

      prevCheckedNodesRef.current = [...prevCheckedNodesRef.current.filter((prevCheckedNode: INodes) => {
        const nodeIndex = nodesStorageRef.current.findIndex((node: INodes) => node.index === prevCheckedNode.index);
        return nodeIndex === -1;
      }), ...nodesStorageRef.current].sort((a: INodes, b: INodes) => a.index - b.index);
      nodesStorageRef.current = [];
  }, [
    alerts,
    ignoredTerms,
    elementXPathResult,
    ignoredCategoriesFromStorage,
    selectedAlertIndex,
  ]);

  const logNewCheckResponses = (newNodesWithAlerts: INodeWithAlerts[], previouslyCheckedNodesWithAlerts: INodes[]) => {
    let newResults;
    if (isTextArea(element) && checkEndpointResponse && unchangedAlertsTextarea) {
      newResults = checkEndpointResponse.results.filter((alert) => {
        return !unchangedAlertsTextarea.map((alert) => alert.startOffset).includes(alert.start);
      });  
    } else {
      newResults = newNodesWithAlerts.reduce((acc: any, nodeWithAlerts: INodeWithAlerts) => {
        const newAlerts = nodeWithAlerts.alerts.filter(() => {
          const prevCheckedNode = previouslyCheckedNodesWithAlerts.find((prevCheckedNode: INodes) => {
            return prevCheckedNode.node === nodeWithAlerts.node?.nodeValue;
          });
          return !prevCheckedNode || prevCheckedNode.index !== nodeWithAlerts.nodeIndex;
        });
        return [...acc, ...newAlerts];
      }
      , []);
    }

    if (newResults.length === 0) return;

    const mergedCheckEndpointResponse = {
      ...checkEndpointResponse,
      results: newResults,
    };
  
    const mergedCheckEndpointResponseWithoutOrthography = {
      ...mergedCheckEndpointResponse,
      results: mergedCheckEndpointResponse.results.filter((result: any) => {
        return result.data.category !== 'orthography';
      }),
    };
      
    if (mergedCheckEndpointResponseWithoutOrthography.results.length === 0) return;
      
    const textContentLength = clone?.firstChild?.textContent ? clone.firstChild.textContent.length : 0;
    mergedCheckEndpointResponseWithoutOrthography.results.forEach((result: any) => {
      analytics.checkResultLog(
        result,
        authResponse,
        textContentLength,
        'check_highlights',
        checkLogEventIdRef.current,
      )
    });
  };
  
  // useEffect(() => {
  //   if(totalMaxCharLengthReachedRef.current && !isWittyPremiumUserRef.current) {
  //     const totalMaxCharLengthReachedNotificationWrapper = document.createElement('div');
  //     totalMaxCharLengthReachedNotificationWrapper.id = 'ww-notification';
  //     if (localStorage.getItem(StorageKeys.TOTAL_MAX_CHAR_LENGTH_NOTIFICATION_SHOWED) === 'true') return;
  //     ReactDOM.render(
  //         <Notification
  //           notificationType={'totalMaxCharLengthReached'}
  //           element={element}
  //         />,
  //       document.body.insertBefore(
  //         totalMaxCharLengthReachedNotificationWrapper,
  //         document.body.firstChild
  //       )
  //     );
  //     localStorage.setItem(StorageKeys.TOTAL_MAX_CHAR_LENGTH_NOTIFICATION_SHOWED, 'true');
  //   }
  // }, [totalMaxCharLengthReachedRef.current]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[],
    elementEvaluation: XPathResult
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];
    if (
      !isTextArea(element) 
    ) {
      let updatedAlerts: IAlert[] = [];
      const nodesForCalculation = nodesWhithinMaxCharLengthRef.current.filter((node: INodes) => {
        return node.node.length > 0;
      }).sort((a: INodes, b: INodes) => a.index - b.index);
      const lowestIndex = nodesForCalculation.reduce(
        (min, node) => (node.index < min ? node.index : min),
        Infinity
      );

      nodesForCalculation.forEach((node) => {
        let absolutePositionOfFirstCharOfNode = 0;
        for (
          let index = lowestIndex;
          index < node.index;
          index++
        ) {
          const text = elementEvaluation.snapshotItem(index)?.textContent;
          absolutePositionOfFirstCharOfNode += text ? text.length + 1 : 0;
        }

        const alertsRelevantToNode = alerts.filter((alert: IAlert) =>
          elementEvaluation
            .snapshotItem(node.index)
            ?.textContent?.includes(alert.data?.text)
        );

        updatedAlerts = alertsRelevantToNode.map((alert: IAlert) => {
          return {
            ...alert,
            startOffset: alert.startOffset - absolutePositionOfFirstCharOfNode,
            endOffset: alert.endOffset - absolutePositionOfFirstCharOfNode,
          };
        });

        //remove updated alerts with negative startOffset
        updatedAlerts = updatedAlerts.filter(
          (alert) => alert.startOffset >= 0 && alert.endOffset >= 0
        );

        updatedAlerts.length > 0 &&
          nodesWithAlertsTemp.push({
            node: elementEvaluation.snapshotItem(
              node.index
            ) as Node, //possibly null
            alerts: updatedAlerts,
            nodeIndex: node.index,
          });
      });
    } else {
      //EVENTUALLY REFACTOR TO ONLY USE ABOVE CONDITION
      let textStartingAbsPosition: number = 0;
      let textEndAbsPosition: number = -1;

      for (let index = 0; index < elementEvaluation.snapshotLength; index++) {
        const node = elementEvaluation.snapshotItem(index) as Node;
        if (node.nodeValue && node.nodeValue.match(/(\u00A0)|\S/i)) {
          if (
            //for handeling long text
            nodesWhithinMaxCharLengthRef.current.length > 0 &&
            !nodesWhithinMaxCharLengthRef.current.some(
              (nodeWithAlertsRef) => nodeWithAlertsRef.index === index
            )
          ) {
            continue;
          }

          textStartingAbsPosition = textEndAbsPosition + 1;
          textEndAbsPosition =
            nodesWhithinMaxCharLengthRef.current.length == 0
              ? textStartingAbsPosition + node.nodeValue.length - 1 //needed to keep highlights in place
              : textStartingAbsPosition + node.nodeValue.length;

          if (nodesWhithinMaxCharLengthRef.current.length == 0) {
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

  const updateTextWithAlternative = (alternative: string, category: string) => {
    alternative = alternative.replace(/\(\(/g, '[').replace(/\)\)/g, ']');
    const node = popoverData?.node as Node;
    const alert = selectedAlert as IAlert;

    if (isTextArea(element) || isInputText(element)) {
      element.selectionStart =
        alternative == ' ' &&
        category !== 'orthography' &&
        alert.startOffset !== 0
          ? alert.startOffset - 1
          : alert.startOffset;
      element.selectionEnd =
        alternative == ' ' && category !== 'orthography'
          ? alert.endOffset + 1
          : alert.endOffset;
      //execCommand IS DEPRECATED, but its the only way to enable undo/redo for now
      getActiveDocument().execCommand('insertText', false, alternative);
    } else {
      const range = getActiveDocument().createRange();
      const startOffset = alternative === ' ' && category !== 'orthography' && alert.startOffset !== 0
        ? alert.startOffset - 1
        : alert.startOffset;
      const endOffset = alternative === ' ' && category !== 'orthography'
        ? alert.endOffset + 1
        : alert.endOffset;
    
    range.setStart(node, startOffset);
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
            setTextToCheck(getInputText(element));
            const event = new Event('keyup', { bubbles: true });
            element.dispatchEvent(event);
          }, 200);
        }, 200);
      } else if (isGoogleDocs()) {
        setIsActive(true);
        setActiveIcon('loading');
        setAlerts([]);

        const rects = range.getBoundingClientRect();
        const selectedTextStart = {
          clientX: rects.x,
          clientY: rects.y + rects.height / 2,
          bubbles: !0,
          shiftKey: !1,
        };
        element.dispatchEvent(new MouseEvent('mousedown', selectedTextStart)),
          element.dispatchEvent(new MouseEvent('mouseup', selectedTextStart));

        const selectedTextEnd = {
          clientX: rects.x + rects.width,
          clientY: rects.y + rects.height / 2,
          bubbles: !0,
          shiftKey: !0,
        };
        element.dispatchEvent(new MouseEvent('mousedown', selectedTextEnd)),
          element.dispatchEvent(new MouseEvent('mouseup', selectedTextEnd));

        //if empty insert space
        const replacementText = alternative == ' ' ? '   ' : alternative;
        const replaceWithPaste = function(alternative: string) {
          const evt = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            cancelable: true,
            bubbles: true,
          });
          if (!evt.clipboardData) return;
          evt.clipboardData.items.add(alternative, 'text/plain');
          const eventTarget = (document.querySelector('.docs-texteventtarget-iframe') as any)
              ?.contentDocument.activeElement;
          eventTarget && eventTarget.dispatchEvent(evt);
        };
        if (navigator.userAgent.match(/firefox|fxios/i)) {
          const ownerDocument = element.ownerDocument;
          const script = ownerDocument.createElement('script');
          script.innerHTML = `(${replaceWithPaste})(${JSON.stringify(replacementText)})`;
          ownerDocument.head.appendChild(script);
          script.parentNode ? script.parentNode.removeChild(script) : script.remove();
        } else {
          replaceWithPaste(replacementText);
        }

        resetPopover();
      } else {
        getActiveDocument().execCommand('insertText', false, alternative);
      }
    }

    if (isTextArea(element)) {
      const unchangedAlerts = nodesWithAlertsRef.current.map((nodeWithAlerts) =>
        nodeWithAlerts.alerts.filter(
          (nodeAlert) => nodeAlert.startOffset < alert.startOffset
        )
      );
      if (unchangedAlerts[0]) setAlerts(unchangedAlerts[0]);
    }
    if (!isCkEditor(element) && !isGoogleDocs()) {
      handleTextAndIcon([]); //ensures update 
      const event = new Event('keyup', { bubbles: true });
      element.dispatchEvent(event);
    }
  };

  useEffect(() => {
    if (checkEndpointError?.status === 422) {
      document.documentElement.setAttribute('witty-could-determine-lang', 'false');
      setAlerts([]);
    } else if (
      checkEndpointError?.status == 403 ||
      (authErrorResponse?.status === 403 && userIsSignedIn)
    ) {
      browser.storage.local
        .get(StorageKeys.REFRESH_TOKEN)
        .then((result) => {
          if (!result[StorageKeys.REFRESH_TOKEN]) {
            logOut();
            return;
          }
          //gets new token using the refresh token
          setRefreshToken(result[StorageKeys.REFRESH_TOKEN]);
        })
        .catch((error: unknown) => {
          sendErrorToSentry(error);
        });
    } else if (authErrorResponse?.status === 400 && window.top) {//400 means means min version not installed
        try {      
          const notificationWrapper = document.createElement('div');
          notificationWrapper.id = 'ww-notification';
      
          ReactDOM.render(
            <Notification
              notificationType={'min_version_not_installed'}
              element={element}
            />,
            window.top.document.body.insertBefore(
              notificationWrapper,
              window.top.document.body.firstChild
            )
          );
        } catch (error) {
          DEV_ENV && console.error("Error in renderNotification:", error);
        }
    }
    log(
      `API Error Status Code ${checkEndpointError?.status}: ${checkEndpointError?.message}`,
      logTypes.ERROR
    );
  }, [checkEndpointError, authErrorResponse]);

  useEffect(() => {
    if (refreshTokenError) {
      logOut();
      return;
    }
    if (!refreshTokenResponse) return;

    storeInLocalStorage(
      StorageKeys.ACCESS_TOKEN,
      refreshTokenResponse.access_token
    );
    setToken(refreshTokenResponse.access_token);
    storeInLocalStorage(
      StorageKeys.REFRESH_TOKEN,
      refreshTokenResponse.refresh_token
    );

    setTextToCheck('');
    setTextToCheck(currentTextToCheck);
  }, [refreshTokenError, refreshTokenResponse]);

  const ErrorBoundaryFallback = () => (
    <Toast message={t('reloadWebsite')} type='error' />
  );

  const storageChange = (changes: any) => {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      switch (item) {
        case StorageKeys.ACCESS_TOKEN:
          setUserIsSignedIn(changes[item].newValue == '' ? false : true);
          setConfigHasChanged(changes[item].newValue == '' ? false : true);
          setTextToCheck('');
          setTextToCheck(currentTextToCheck);
          break;
      }
    }
  };

  useEffect(() => {
    const popoverElement = document.querySelector(WTags.WW_POPOVER) || document.createElement(WTags.WW_POPOVER);
    if (!document.body.contains(popoverElement)) {
      const element = document.createElement(WTags.WW_POPOVER);
      document.body.appendChild(element);
    }
    //Show/Hide the popover
    if (
      popoverData &&
      userIsSignedIn &&
      popoverData.alert.plan === 'witty_free' &&
      !popoverData.alert.data.explanation //if no explanation returned, its a premium feature
    ) {
      ReactDOM.render(
        <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
          <HighlightPopoverUpgrade
            element={element}
            data={popoverData}
            prevData={previousPopoverDataRef.current}
            hide={resetPopover}
            addIgnoredCategory={addIgnoredCategory}
          />
        </Sentry.ErrorBoundary>,
        document.querySelector(WTags.WW_POPOVER)
      );
    } else if (popoverData && userIsSignedIn) {
      ReactDOM.render(
        <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
          <HighlightPopover
            element={element}
            data={popoverData}
            prevData={previousPopoverDataRef.current}
            hide={resetPopover}
            updateTextWithAlternative={updateTextWithAlternative}
            addIgnoredTerm={addIgnoredTerm}
            movePopoverNextOrPrev={movePopoverNextOrPrev}
            userIsSignedIn={userIsSignedIn}
          />
        </Sentry.ErrorBoundary>,
        document.querySelector(WTags.WW_POPOVER)
      );
    } else if (popoverData && !userIsSignedIn) {
      ReactDOM.render(
        <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
          <HighlightPopoverNotSignedIn
            element={element}
            data={popoverData}
            prevData={previousPopoverDataRef.current}
            hide={resetPopover}
          />
        </Sentry.ErrorBoundary>,
        document.querySelector(WTags.WW_POPOVER)
      );
    } else {
      const popoverElement = document.querySelector(WTags.WW_POPOVER);
      if (popoverElement && popoverElement.childNodes.length > 0) {
        ReactDOM.unmountComponentAtNode(popoverElement);
      }
    }
  }, [popoverData]);

  return (
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
      {isGoogleDocs() && <WTags.WW_CLONE></WTags.WW_CLONE>}
      {(isGoogleDocs() || !isTextArea(element)) && !isActive && nodesWithAlerts.length > 0 && (
        <WTags.WW_HIGHLIGHTS>
          <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
            <Highlights
              elementScroll={elementScroll}
              nodesWithAlerts={nodesWithAlerts}
              element={element}
              elementRect={elementRect}
              selectedAlert={popoverData && popoverData?.alert}
              userIsSignedIn={userIsSignedIn}
              removeHighlights={removeHighlights}
              forceHighlightUpdate={forceHighlightUpdate}
            />
          </Sentry.ErrorBoundary>
        </WTags.WW_HIGHLIGHTS>
      )}
      {isTextArea(element) && (
        <WTags.WW_HIGHLIGHTS>
          <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
            <Highlights
              elementScroll={elementScroll}
              nodesWithAlerts={nodesWithAlerts}
              element={element}
              elementRect={elementRect}
              selectedAlert={selectedAlert}
              userIsSignedIn={userIsSignedIn}
              removeHighlights={removeHighlights}
              forceHighlightUpdate={forceHighlightUpdate}
            />
          </Sentry.ErrorBoundary>
        </WTags.WW_HIGHLIGHTS>
      )}
      <WTags.WW_ACTIVITY_INDICATOR>
        <StateIndicatorIcon
          element={element}
          elementRect={elementRect}
          iconType={totalMaxCharLengthReachedRef.current ? 'warning' : activeIcon}
          isHovered={isHovered}
        />
      </WTags.WW_ACTIVITY_INDICATOR>
    </>
    
  );
};

export default Input;
