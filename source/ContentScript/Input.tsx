import React, { useState, useEffect, useCallback } from 'react';
import { browser } from 'webextension-polyfill-ts';

import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import { WTags, StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import Notification from '../Notifications/Notification';
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
  updateConfig,
} from './utils';
import { getActiveDocument } from './ContentScriptApp';
import HighlightPopoverNotSignedIn from './HighlightPopover/HighlightPopoverNotSignedIn';
import HighlightPopoverUpgrade from './HighlightPopover/HighlightPopoverUpgrade';

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
    top: 0,
    left: 0,
  } as Position);
  const [removeHighlights, setRemoveHighlights] = useState<boolean>(false);
  const [forceHighlightUpdate, setForceHighlightUpdate] =
    useState<boolean>(false);
  const [windowScroll, setWindowScroll] = useState<Position>({
    top: 0,
    left: 0,
  } as Position);
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
  const [activeIcon, setActiveIcon, activeIconRef] = useStateRef('active');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [elementXPathResult, setElementXPathResult] = useState<XPathResult>();
  const [debounceDelay, setDebounceDelay] = useState<number>(
    defaultConfig.API_DELAY
  );
  const [isActive, setIsActive] = useState<boolean>(false);
  const [ignoredCategoriesFromStorage, setIgnoredCategoriesFromStorage] =
    useState<IgnoredCategory[]>([]);
  const [userIsSignedIn, setUserIsSignedIn] = useState<boolean>(false);
  const maxCharLength = defaultConfig.MAX_CHAR_LENGTH;
  const minCharLength = defaultConfig.MIN_CHAR_LENGTH;
  const totalMaxCharLength = defaultConfig.TOTAL_MAX_CHAR_LENGTH;
  const [, , totalMaxCharLengthReachedRef] = useStateRef<boolean>(false);
  const backgroundRequestCharLength =
    defaultConfig.BACKGROUND_REQUEST_CHAR_LENGTH;
  const backgroundRequestInterval = defaultConfig.BACKGROUND_REQUEST_INTERVAL;
  const [backgroundWorkerStarted, setBackgroundWorkerStarted] = useState(false);
  const [, , abortBackgroundWorkerRef] = useStateRef<boolean>(false);
  const [, , firstScrollableParentRef] = useStateRef<HTMLElement>(element);
  const [, , previouslyCheckedPagesGoogleDocs] = useStateRef<number[]>([]);
  const [unchangedAlertsTextarea, setUnchangedAlertsTextarea] = useState<
    IAlert[]
  >([]);
  const [, , isWittyPremiumUserRef] = useStateRef<boolean>(true);
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
    if (!pagesZIndex.every((page) => previouslyCheckedPagesGoogleDocs.current.includes(page)) && isGoogleDocs() ) {
      previouslyCheckedPagesGoogleDocs.current = [
        ...new Set([...previouslyCheckedPagesGoogleDocs.current, ...pagesZIndex]),
      ];
      if (prevCheckedNodesRef.current.length > 0 ) {
        abortBackgroundWorkerRef.current = false;
        backgroundWorker(cloneRef.current);
      }
    }
  }, 500);

  useMutationObserver(element, onElementMutation);
  const { t } = useTranslation([namespaces.errors]);
  const log = useLog('Input');

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setDebounceDelay(result[StorageKeys.API_DELAY] as number);
        setUserIsSignedIn(result[StorageKeys.ACCESS_TOKEN] as boolean);
        result[StorageKeys.PLAN] === 'witty_free' && (isWittyPremiumUserRef.current = false);
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
    const newScrollableParent = getScrollParent(element);
    if (newScrollableParent)
      firstScrollableParentRef.current = newScrollableParent;

    window.addEventListener('scroll', handleWindowScrollEvent);
    if(!isGoogleDocs()) {
      element.addEventListener('focusout', handleFocusoutEvent);
      element.addEventListener('focusin', handleFocusinEvent);
    }
    element.addEventListener('mouseover', handleMouseoverEvent);
    element.addEventListener('mouseout', handleMouseoutEvent);
    firstScrollableParentRef.current.addEventListener(
      'scroll',
      handleElementScrollEvent,
      true
    );

    element.addEventListener('dblclick', handleElementClickEvent as any);
    element.addEventListener('click', handleElementClickEvent as any);

    if (isGoogleDocs()) {
      googleDocsEventTarget.addEventListener('focusout', handleFocusoutEvent);
      document.addEventListener(
        'click',
        handleDocumentClickEvent as EventListener
      );
      document.addEventListener('scroll', handleElementScrollEvent, true);
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
      window.removeEventListener('scroll', handleWindowScrollEvent);
      if(!isGoogleDocs()) {
        element.removeEventListener('focusout', handleFocusoutEvent);
        element.removeEventListener('focusin', handleFocusinEvent);
      }

      firstScrollableParentRef.current.removeEventListener(
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

  const handleWindowScrollEvent = () => {
    setWindowScroll({
      top: window.scrollY,
      left: window.scrollX,
    });
  };
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
        updatedNodesWithAlerts[newSelectedNodeWithAlertsIndex] &&
        updatedNodesWithAlerts[newSelectedNodeWithAlertsIndex].alerts.findIndex(
          (alert) => alert === selectedAlert
        );

      //LONG TEXT CLICK
      if (
        getInputText(cloneRef.current).length > maxCharLength &&
        (newSelectedAlertIndex < 0 || newSelectedAlertIndex === undefined) &&
        !totalMaxCharLengthReachedRef.current
      ) {
        const clickedElement = [] as ChildNode[];
        if (!cloneRef.current || !cloneRef.current.childNodes) {
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
    handleKeyupEvent(); 

   if (isNotion()) {
      document
        .querySelector('.notion-frame')
        ?.addEventListener('keyup', handleKeyupEvent);
    } else {
      element.addEventListener('keyup', handleKeyupEvent);
    }
    element.addEventListener('paste', handleKeyupEvent);


    return () => {
      //Don't forget to remove the listeners at the end
      if (isNotion()) {
        document
          .querySelector('.notion-frame')
          ?.removeEventListener('keyup', handleKeyupEvent);
      } else {
        element.removeEventListener('keyup', handleKeyupEvent);
      }
      element.removeEventListener('paste', handleKeyupEvent);
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

  //divides the nodes into chunks of length backgroundRequestCharLength, send chunks to api with interval backgroundRequestInterval
  const backgroundWorker = (element: HTMLElement) => {
    const textDividedByNodes = getTextDividedByNodes(
      element as CustomInputElement
    );

    //fiter out nodes that have been checked before and have not changed
    const textDividedByNodesWithoutCheckedNodes = textDividedByNodes.filter(
      (node) => {
        const nodeIsChecked = prevCheckedNodesRef.current.find(
          (prevNode) =>
          prevNode.rawNode && prevNode.rawNode === node 
        );
        return !nodeIsChecked || nodeIsChecked.node.length > 0; 
      }
    );

    const nodesWithinBackgroundRequestLength = [] as {
      text: string;
      nodes: {
        node: string;
        index: number;
        rawNode: Node;
      }[];
    }[];

    let textLength = 0;
    textDividedByNodesWithoutCheckedNodes.forEach((node) => {
      const text = node.textContent ? node.textContent : '';
      const index = textDividedByNodes.indexOf(node);
      if(text.length > 0) {
        if (
          textLength + (node.textContent ? node.textContent.length : 0) <=
          backgroundRequestCharLength
        ) {
          textLength += node.textContent ? node.textContent.length : 0;
          const lastNode = nodesWithinBackgroundRequestLength.pop();

          if (lastNode) {
            lastNode.text += text;
            lastNode.nodes.push({
              node: text,
              index: index,
              rawNode: node,
            });
            nodesWithinBackgroundRequestLength.push(lastNode);
          } else {
            nodesWithinBackgroundRequestLength.push({
              text: text,
              nodes: [{ node: text, index: index, rawNode: node }],
            });
          }
        } else {
          nodesWithinBackgroundRequestLength.push({
            text: node.textContent ? node.textContent : '',
            nodes: [{ node: text, index: index, rawNode: node }],
          });
          textLength = node.textContent ? node.textContent.length : 0;
        }
      }
    });
    
    const interval = setInterval(() => {
      if (nodesWithinBackgroundRequestLength.length == 0 || abortBackgroundWorkerRef.current) {
        abortBackgroundWorkerRef.current = false;
        clearInterval(interval);
        setBackgroundWorkerStarted(false);
        return;
      }
      const nextText = nodesWithinBackgroundRequestLength.shift();
      handleTextAndIcon(nextText?.nodes);
    }, backgroundRequestInterval);
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

  const handleKeyupEvent = (event?: Event, gDocs?: boolean) => {
    if (prevSelectedAlertIndex.current != -1 && !gDocs) resetPopover();
    event && (abortBackgroundWorkerRef.current = true);

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
    const textDividedByNodesTextContent = isTextArea(element)
      ? nextText
      : (nextTextDividedByNodes.map((node) => node.textContent) as string[]);

    const fistTextDiff = getFirstTextDiff(
      element,
      textDividedByNodesTextContent,
      previousElementStateRef.current.text
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
        nextTextDividedByNodes[fistTextDiff ? fistTextDiff.node : 0];

      const textWithinMaxCharLength = getTextWithinMaxCharLength(
        fistTextDiff ? fistTextDiff.node : 0,
        nodeAtFirstTextDiff
      );
      textWithinMaxCharLength &&
        handleTextAndIcon(
          textWithinMaxCharLength
        );
    }
  };

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
    let nodesToCheck = isTextAreaCheck ? nodes : nodes.filter((node: INodes) => {
      const nodeIndex = prevCheckedNodesRef.current.findIndex(
        (prevCheckedNode: INodes) =>
          prevCheckedNode.rawNode === node.rawNode && //important for highlight placement -> problem with new text 
          prevCheckedNode.node === node.node 
        );
      return nodeIndex === -1;
    });
    nodesStorageRef.current = nodesToCheck;
    let newTextToCheck = isTextAreaCheck ? nodes : nodesToCheck.map((node: any) => node.node).join('\n');
    const clonedElement = document.querySelector(WTags.WW_CLONE)?.textContent;
    const totalTextLength = isTextAreaCheck && clonedElement ? clonedElement?.length : getTextDividedByNodes(element).map((node: any) => node.textContent).join('')?.length;
    if (isTextAreaCheck && totalTextLength > totalMaxCharLength && !isWittyPremiumUserRef.current) {
      totalMaxCharLengthReachedRef.current = true;
      analytics.maxCharLengthReachedLog('max_char_length_reached');
      const lastSpaceIndex = nodes[0].lastIndexOf('', totalMaxCharLength);
      newTextToCheck = nodes[0].slice(0, lastSpaceIndex);
    } else if (!isTextAreaCheck && totalTextLength > totalMaxCharLength && !isWittyPremiumUserRef.current) {  
      totalMaxCharLengthReachedRef.current = true;
      analytics.maxCharLengthReachedLog('max_char_length_reached');
      abortBackgroundWorkerRef.current = true;  
      const prevCheckedNodesRefWithoutNodesToCheck = prevCheckedNodesRef.current.filter((prevCheckedNode: INodes) => {
        const nodeIndex = nodesToCheck.findIndex((node: INodes) => node.index === prevCheckedNode.index);
        return nodeIndex === -1;
      });
      prevCheckedNodesRef.current = prevCheckedNodesRefWithoutNodesToCheck;

      const allNodes = [...prevCheckedNodesRefWithoutNodesToCheck, ...nodesToCheck]
        .sort((a: any, b: any) => a.index - b.index)
        .map((node: any) => node.rawNode)
      if (allNodes.length === 0) return;  

      const nodesWithinTotalMaxCharLength = getNodesWithinMaxCharLength('below', allNodes, -1, totalMaxCharLength*2);
      newTextToCheck = nodesWithinTotalMaxCharLength.map((node) => node.node).join('\n');
    } else {  
      isTextAreaCheck && (newTextToCheck = nodes[0]); 
      totalMaxCharLengthReachedRef.current = false;
      abortBackgroundWorkerRef.current = false;
    }
    
    //if text length of node is smaller than MIN_CHAR_LENGTH length, add nodes until min char length is reached
    if (newTextToCheck.length < minCharLength && newTextToCheck.length !== 0) {
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
        
    if (newTextToCheck.length === 0 || !newTextToCheck.match(/[a-zA-Z0-9.:;,?!]/i)) {
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
      (prev: number, current: { node: string }) => prev + current.node.length,
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
    if (!isTextArea(element)) {
      setIsActive(true);
      setActiveIcon('loading');
      debouncedScroll();
    } 

    !isGoogleDocs() && setElementScroll({
        top: isTextArea(element) ? element.scrollTop : firstScrollableParentRef.current.scrollTop,
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
      handleKeyupEvent();
    }
  };

  const resetPopover = () => {
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
    abortBackgroundWorkerRef.current = true;
    
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
          oneNodeWithAlerts &&
          oneNodeWithAlerts.alerts.findIndex((alert: IAlert) => {
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

          selectedAlertIndex =
            oneNodeWithAlerts &&
            oneNodeWithAlerts.alerts.findIndex(
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
    const textDividedByNodes = getTextDividedByNodes(element);

    if (isGoogleDocs() && caret.position) {
      const textWithinMaxCharLength = getTextWithinMaxCharLength(
        caret.position,
        cloneRef.current?.childNodes[caret.position]
      );
      textWithinMaxCharLength && handleTextAndIcon(textWithinMaxCharLength);
    } else if (!isGoogleDocs()) {
      let clickedNode = caret.element;

      if (clickedNode) {
        const textWithinMaxCharLength = getTextWithinMaxCharLength(
          textDividedByNodes.indexOf(clickedNode),
          caret.element
        );
        textWithinMaxCharLength && handleTextAndIcon(textWithinMaxCharLength);
      }
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
    if (
      !backgroundWorkerStarted &&
      !isTextArea(element) && //does not work on textArea yet
      !isGoogleDocs() && //google docs is handled on mutation
      getInputText(element).length > maxCharLength
    ) {
      abortBackgroundWorkerRef.current = false;
      backgroundWorker(element);
      setBackgroundWorkerStarted(true);
    }

    if (!checkEndpointResponse) return;
    setRemoveHighlights(false);

    setConfigHasChanged(checkEndpointResponse.config_changed ? true : false);

    checkEndpointResponse.notifications
      ? storeInLocalStorage(
          StorageKeys.NUMBER_OF_NOTIFICATIONS,
          checkEndpointResponse.notifications
        )
      : storeInLocalStorage(StorageKeys.NUMBER_OF_NOTIFICATIONS, 0);

    setActiveIcon('active');
    
    // console.log('checkEndpointResponse', checkEndpointResponse);
    // console.log('prevCheckedNodesRef', prevCheckedNodesRef);
    // console.log('nodesWithAlertsRef.current', nodesWithAlertsRef.current); //figure out where/how this is made -> find diff -> log that only

    // analytics.checkLog(
    //   checkEndpointResponse,
    //   authResponse,
    //   clone?.firstChild?.textContent ? clone?.firstChild.textContent.length : 0
    // );

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
    } else {
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
          (alert: IAlert) => !ignoredTerms.includes(alert.data.text)
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

      const mergedNodesWithAlerts = [
        ...nodesWithAlertsRef.current.filter(
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
      logNewCheckResponses(nodesWithAlertsRef.current);

      prevCheckedNodesRef.current = [...prevCheckedNodesRef.current.filter((prevCheckedNode: INodes) => {
        const nodeIndex = nodesStorageRef.current.findIndex((node: INodes) => node.index === prevCheckedNode.index);
        return nodeIndex === -1;
      }), ...nodesStorageRef.current].sort((a: INodes, b: INodes) => a.index - b.index);

      nodesStorageRef.current = [];
    }
  }, [
    alerts,
    ignoredTerms,
    elementXPathResult,
    ignoredCategoriesFromStorage,
    selectedAlertIndex,
  ]);

  const logNewCheckResponses = (newNodes: INodeWithAlerts[]) => {
    let newResults;
  
    if (isTextArea(element) && checkEndpointResponse && unchangedAlertsTextarea) {
      newResults = checkEndpointResponse.results.filter((alert) => {
        return !unchangedAlertsTextarea.map((alert) => alert.startOffset).includes(alert.start);
      });  
    } else {
      newResults = newNodes.filter((nodeWithAlerts) => {
        return nodesStorageRef.current.map((node) => node.rawNode).includes(nodeWithAlerts.node);
      }).map((nodeWithAlerts) => {
        const mergedAlerts = nodeWithAlerts.alerts.reduce((mergedAlerts, alert) => {
          return {
            ...mergedAlerts,
            ...alert.data,
          };
        }, {}); 
        return mergedAlerts;
      });
    }

    if (newResults.length === 0) return;

    const mergedCheckEndpointResponse = checkEndpointResponse ? {
      ...checkEndpointResponse,
      results: newResults as any,
    } : undefined;
  
    const textContentLength = clone?.firstChild?.textContent ? clone.firstChild.textContent.length : 0;
    mergedCheckEndpointResponse && analytics.checkLog(mergedCheckEndpointResponse, authResponse, textContentLength);
  };
  
  useEffect(() => {
    if(totalMaxCharLengthReachedRef.current && !isWittyPremiumUserRef.current) {
      const totalMaxCharLengthReachedNotificationWrapper = document.createElement('div');
      totalMaxCharLengthReachedNotificationWrapper.id = 'ww-notification';
      ReactDOM.render(
          <Notification
            notificationType={'totalMaxCharLengthReached'}
          />,
        document.body.insertBefore(
          totalMaxCharLengthReachedNotificationWrapper,
          document.body.firstChild
        )
      );
    }
  }, [totalMaxCharLengthReachedRef.current]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[],
    elementEvaluation: XPathResult
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];
    if (
      !isTextArea(element) 
    ) {
      let updatedAlerts: IAlert[] = [];
      const nodesForCalculation = (totalMaxCharLengthReachedRef.current ? nodesWhithinMaxCharLengthRef.current : nodesStorageRef.current).filter((node: INodes) => {
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
            ?.textContent?.includes(alert.data.text)
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
                node.nodeValue && node.nodeValue.includes(alert.data.text)
            )
            .filter(
              (alert: IAlert) =>
                (alert.startOffset >= textStartingAbsPosition &&
                  alert.endOffset <= textEndAbsPosition) ||
                (isLinkedin() && alert.data.text.includes('#'))
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

      range.setStart(
        node,
        alternative == ' ' &&
          category !== 'orthography' &&
          alert.startOffset !== 0
          ? alert.startOffset - 1
          : alert.startOffset
      );
      range.setEnd(
        node,
        alternative == ' ' && category !== 'orthography'
          ? alert.endOffset + 1
          : alert.endOffset
      );
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
        const insertAlternative = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
          cancelable: true,
          bubbles: true,
        });
        if (!insertAlternative.clipboardData) return;
        insertAlternative.clipboardData.setData(
          'text/plain',
          alternative == ' ' ? '   ' : alternative
        );
        googleDocsEventTarget.dispatchEvent(insertAlternative);
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
    } 
    else if(checkEndpointError?.status === 500) { 
      abortBackgroundWorkerRef.current = true; //stop sending requests if server is down
    }
    log(
      `API Error Status Code ${checkEndpointError?.status}: ${checkEndpointError?.message}`,
      logTypes.ERROR
    );
  }, [checkEndpointError, authErrorResponse]);

  useEffect(() => {
    if (refreshTokenError?.status === 403) {
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
              selectedAlert={popoverData && popoverData.alert}
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
          windowScroll={windowScroll}
        />
      </WTags.WW_ACTIVITY_INDICATOR>
    </>
    
  );
};

export default Input;
