import React, { useState, useEffect, useCallback } from 'react';
import { browser } from 'webextension-polyfill-ts';

import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import { WTags, StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';

import TextAreaClone from './TextAreaClone';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import {
  CustomInputElement,
  IAlert,
  IExplanation,
  IgnoredCategory,
  INodeWithAlerts,
  Position,
} from '../shared/types';
import {
  storeInLocalStorage,
  addLoginBadge,
  getRandomToken,
} from '../shared/utils';
import {
  isTextArea,
  isInputText,
  isCkeEditor,
  isGoogleDocs,
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
    { node: string; index: number }[]
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
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);

  const [nodesWithAlerts, setNodesWithAlerts, nodesWithAlertsRef] = useStateRef(
    [] as INodeWithAlerts[]
  );
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
    setIsActive(false);
    setActiveIcon('active');

    ReactDOM.render(
      <GoogleDocsClone
        element={element}
        previousElement={previousElementStateRef.current}
        updateClone={updateCloneData}
      />,
      document.querySelector(WTags.WW_CLONE)
    );
  }, 1000);

  useMutationObserver(element, onElementMutation);
  const { t } = useTranslation([namespaces.errors]);
  const log = useLog('Input');

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setDebounceDelay(result[StorageKeys.API_DELAY] as number);
        setUserIsSignedIn(result[StorageKeys.ACCESS_TOKEN] as boolean);

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

    !isGoogleDocs() &&
      element.addEventListener('focusout', handleFocusoutEvent);
    element.addEventListener('mouseover', handleMouseoverEvent);
    element.addEventListener('mouseout', handleMouseoutEvent);
    element.addEventListener('scroll', handleElementScrollEvent, true);
    element.addEventListener('click', handleElementClickEvent as EventListener);

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
      !isGoogleDocs() &&
        element.removeEventListener('focusout', handleFocusoutEvent);
      element.removeEventListener('scroll', handleElementScrollEvent);
      element.removeEventListener(
        'click',
        handleElementClickEvent as EventListener
      );

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
  const handleDocumentClickEvent = (event: any) => {
    if (getInputText(cloneRef.current).length === 0) debouncedMutation();
    const activeDocument = getActiveDocument();
    //CHECK IS DOM CONTAINS ELEMENT WITH ID witty-works-ext-popover

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
                  x: rect.left,
                  top: rect.top - elementScroll.top,
                  y: rect.top - elementScroll.top,
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
            googleDocsElementCursorRect.top + 2 >= alertRect.top && //+ 2 adds some slack for weird fonts
            googleDocsElementCursorRect.left >= alertRect.left &&
            googleDocsElementCursorRect.left <=
              alertRect.left + alertRect.width &&
            googleDocsElementCursorRect.top + 2 <=
              alertRect.top + alertRect.height
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
        (newSelectedAlertIndex < 0 || newSelectedAlertIndex === undefined)
      ) {
        const clickedElement = [] as ChildNode[];
        if (!cloneRef.current || !cloneRef.current.childNodes) {
          return;
        }
        //get which cloneRef.current is under googleDocsElementCursorRect
        cloneRef.current.childNodes.forEach((clone) => {
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
        handleElementClickLongText(caret, event);
      }
      setSelectedNodeWithAlertsIndex(newSelectedNodeWithAlertsIndex);
      setSelectedAlertIndex(newSelectedAlertIndex);
    }
  };

  useEffect(() => {
    handleKeyupEvent();
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'

    if (isGoogleDocs()) {
      //keyup comes from clone update
      googleDocsEventTarget.addEventListener('focusin', handleFocusinEvent);
    } else {
      element.addEventListener('keyup', handleKeyupEvent);
      element.addEventListener('focusin', handleFocusinEvent);
    }

    return () => {
      //Don't forget to remove the listeners at the end
      if (isGoogleDocs()) {
        googleDocsEventTarget.removeEventListener(
          'focusin',
          handleFocusinEvent
        );
      } else {
        element.removeEventListener('keyup', handleKeyupEvent);
        element.removeEventListener('focusin', handleFocusinEvent);
      }
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

  const handleFocusinEvent = (event: Event) => {
    const nextText: string = isGoogleDocs()
      ? getInputText(cloneRef.current)
      : getInputText(element);
    handleTextAndIcon(nextText, event);
  };

  const handleFocusoutEvent = () => {
    setActiveIcon('passive');
    setAlerts([]);
    setTextToCheck('');
  };

  const handleDocumentResizeEvent = () => {
    setAlerts([]);
    debouncedMutation();
  };

  const handleKeyupEvent = (event?: Event, gDocs?: boolean) => {
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
    const textDividedByNodesTextContent = isTextArea(element)
      ? nextText
      : (nextTextDividedByNodes.map((node) => node.textContent) as string[]);

    console.log('nextText', nextText);
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
      handleTextAndIcon(nextText, event);
    } else {
      //if (fistTextDiff)
      //FOR FUTURE TICKET -> TO ONLY HIDE ALERTS BELOW CHANGE (NEEDS SOME TWEAKING)
      //   const unchangedNodesWithAlerts = nodesWithAlertsRef.current.filter(
      //     (nodeWithAlerts) =>
      //       nodeWithAlerts.nodeIndex &&
      //       nodeWithAlerts.nodeIndex <= fistTextDiff.node
      //   );

      //   //create object thant node text and node index from unchangedAlerts
      //   const unchangedAlertsNodeAndNodeIndex = unchangedNodesWithAlerts.map(
      //     (nodeWithAlerts) => {
      //       if (nodeWithAlerts.node.textContent && nodeWithAlerts.nodeIndex) {
      //         return {
      //           node: nodeWithAlerts.node.textContent,
      //           index: nodeWithAlerts.nodeIndex,
      //         };
      //       } else {
      //         return {
      //           node: '',
      //           index: -1,
      //         };
      //       }
      //     }
      //   );

      //   const unchangedAlerts = nodesWithAlertsRef.current.map((nodeWithAlerts) =>
      //     nodeWithAlerts.alerts.filter(
      //       () =>
      //         nodeWithAlerts.nodeIndex &&
      //         nodeWithAlerts.nodeIndex <= fistTextDiff.node
      //     )
      //   );

      //   const mergedUnchangedAlerts = unchangedAlerts.reduce(
      //     (acc, curr) => [...acc, ...curr],
      //     []
      //   );
      //   nodesWhithinMaxCharLengthRef.current = unchangedAlertsNodeAndNodeIndex;

      //   setAlerts(mergedUnchangedAlerts);
      // }
      if (nextText.length > maxCharLength) {
        !isGoogleDocs() && setAlerts([]);
        const nodeAtFirstTextDiff =
          nextTextDividedByNodes[fistTextDiff ? fistTextDiff.node : 0];

        const textWithinMaxCharLength = getTextWithinMaxCharLength(
          fistTextDiff ? fistTextDiff.node : 0,
          nodeAtFirstTextDiff
        );

        textWithinMaxCharLength &&
          handleTextAndIcon(textWithinMaxCharLength, event);
      } else {
        !isGoogleDocs() && setAlerts([]);
        handleTextAndIcon(nextText, event);
      }
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
      currentNodeRaw,
      currentNode,
      charLengthLeft
    );
    const nodesWhithinMaxCharLengthAboveNode = getNodesWithinMaxCharLength(
      'above',
      textDividedByNodes,
      currentNodeRaw,
      currentNode,
      charLengthLeft
    );

    const currentNodeFormatted = [
      {
        node: currentNodeRaw.textContent as string,
        index: currentNode,
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

    const textWithinMaxCharLength = nodesWhithinMaxCharLength
      .map((node) => node.node)
      .join('\n');

    if (currentText.length > maxCharLength) {
      const shortenedText = currentText.slice(0, maxCharLength);
      nodesWhithinMaxCharLengthRef.current = [
        {
          node: shortenedText,
          index: currentNode,
        },
      ];
      return shortenedText;
    } else {
      nodesWhithinMaxCharLengthRef.current = nodesWhithinMaxCharLength;
      return textWithinMaxCharLength;
    }
  };

  const handleTextAndIcon = (text: string, event?: Event) => {
    console.log('text to check', text.length, text);

    //If there isn't text, there's nothing to highlight
    setCurrentTextToCheck(text); //for check call after refresh token
    if (text.length === 0 || !text.match(/[a-zA-Z0-9.:;,?!]/i)) {
      setActiveIcon('active');
      setNodesWithAlerts([]);
      setTextToCheck('');
    } else {
      if (event && event.type == 'keyup') {
        debouncedSetTextToCheck(text);
        setActiveIcon('loading');
      } else {
        setTextToCheck(text);
        setActiveIcon('active');
      }
    }
  };

  const debouncedSetTextToCheck = debounce((text: string) => {
    //In this case always create a new string to force change the state of setTextToCheck
    setTextToCheck(text);
  }, debounceDelay);

  const handleElementScrollEvent = () => {
    if (isGoogleDocs()) {
      setIsActive(true);

      setActiveIcon('loading');
      debouncedScroll();
    } else {
      setElementScroll({ top: element.scrollTop, left: element.scrollLeft });
    }
  };

  const debouncedScroll = debounce(() => {
    setIsActive(false);
    setActiveIcon('active');
  }, 500);
  console.log('isActive', isActive);
  const handleSubmitFormEvent = () => {
    //It's assumed that when user sends info through a form, text will disappear.
    //Therefore highlights also need to be removed
    setNodesWithAlerts([]);
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
      //create clone update event
      const cloneUpdateEvent = new CustomEvent('cloneUpdate', {
        detail: { clone: newClone },
      });

      handleKeyupEvent(cloneUpdateEvent, true);
    }
  };

  const resetPopover = () => {
    setPopoverData(null);
    setSelectedAlert(null);
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

  let singleClickTimeOut: ReturnType<typeof setTimeout>;

  const handleElementClickEvent = (event: MouseEvent) => {
    // If user clicks on an element only once...
    if (event.detail === 1) {
      singleClickTimeOut = setTimeout(function () {
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
                //If alert is a one character word, take in consideration clicking the position before or after the char
                return alert.data.text.length === 1
                  ? alert.startOffset <= caretPos && alert.endOffset >= caretPos
                  : alert.startOffset < caretPos && alert.endOffset > caretPos;
              });

            const selectedAlerts = oneNodeWithAlerts.alerts.filter(
              (alert: IAlert) =>
                alert.startOffset <= caretPos && alert.endOffset >= caretPos
            );

            if (
              getInputText(element).length > maxCharLength &&
              !isTextArea(element) &&
              selectedAlerts.length == 0 &&
              !isGoogleDocs()
            ) {
              handleElementClickLongText(caret, event);
            }

            if (selectedAlerts.length > 1) {
              const alertWithLargestStartoffset = selectedAlerts.reduce(
                (prev: IAlert, current: IAlert) => {
                  return prev.startOffset > current.startOffset
                    ? prev
                    : current;
                }
              );

              selectedAlertIndex =
                oneNodeWithAlerts &&
                oneNodeWithAlerts.alerts.findIndex(
                  (alert: IAlert) =>
                    alert.startOffset ===
                    alertWithLargestStartoffset.startOffset
                );
            }

            if (selectedAlertIndex === -1) return;
            if (prevSelectedAlertIndex.current === selectedAlertIndex) {
              resetPopover();
              return;
            }

            setSelectedAlertIndex(selectedAlertIndex);
          } else if (
            getInputText(element).length > maxCharLength &&
            !isTextArea(element) &&
            !isGoogleDocs()
          ) {
            handleElementClickLongText(caret, event);
          }
        }
      }, 400);
    } else {
      clearTimeout(singleClickTimeOut);
    }
  };

  const handleElementClickLongText = (
    caret: {
      position: number | null;
      element: Node | null;
    },
    event: MouseEvent
  ): void => {
    setAlerts([]);
    setTextToCheck('');
    const textDividedByNodes = getTextDividedByNodes(element);

    if (isGoogleDocs() && caret.position) {
      const textWithinMaxCharLength = getTextWithinMaxCharLength(
        caret.position,
        cloneRef.current?.childNodes[caret.position]
      );
      if (textWithinMaxCharLength)
        handleTextAndIcon(textWithinMaxCharLength, event);
    } else if (!isGoogleDocs()) {
      let clickedNode = caret.element;

      if (clickedNode) {
        const textWithinMaxCharLength = getTextWithinMaxCharLength(
          textDividedByNodes.indexOf(clickedNode),
          caret.element
        );
        if (textWithinMaxCharLength)
          handleTextAndIcon(textWithinMaxCharLength, event);
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
    if (!checkEndpointResponse) return;

    setConfigHasChanged(checkEndpointResponse.config_changed ? true : false);

    checkEndpointResponse.notifications
      ? storeInLocalStorage(
          StorageKeys.NUMBER_OF_NOTIFICATIONS,
          checkEndpointResponse.notifications
        )
      : storeInLocalStorage(StorageKeys.NUMBER_OF_NOTIFICATIONS, 0);

    setActiveIcon('active');

    analytics.checkLog(
      checkEndpointResponse,
      authResponse,
      clone?.firstChild?.textContent ? clone?.firstChild.textContent.length : 0
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
    if (alerts.length === 0) setNodesWithAlerts([]);
    else {
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

      // add getBoundingClientRect to each alert
      const nodesWithAlertsTempWithRect = nodesWithAlertsTemp.map(
        (nodeWithAlerts) => {
          const nodeWithAlertsWithRect = {
            ...nodeWithAlerts,
            alerts: nodeWithAlerts.alerts.map((alert) => {
              const range = getActiveDocument().createRange();

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
                  x: rect.left,
                  top: rect.top - elementScroll.top,
                  y: rect.top - elementScroll.top,
                },
              };
            }),
          };
          return nodeWithAlertsWithRect;
        }
      );

      //Set the total alerts
      const totalAlerts: number = nodesWithAlertsTempWithRect.reduce(
        (total, node) => total + node.alerts.length,
        0
      );
      setTotalAlerts(totalAlerts);
      setNodesWithAlerts(nodesWithAlertsTempWithRect as INodeWithAlerts[]);
    }
  }, [
    alerts,
    ignoredTerms,
    elementXPathResult,
    ignoredCategoriesFromStorage,
    selectedAlertIndex,
  ]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[],
    elementEvaluation: XPathResult
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];
    if (
      nodesWhithinMaxCharLengthRef.current.length > 0 &&
      !isTextArea(element)
    ) {
      let updatedAlerts: IAlert[] = [];

      const lowestIndex = nodesWhithinMaxCharLengthRef.current.reduce(
        (min, node) => (node.index < min ? node.index : min),
        Infinity
      );
      nodesWhithinMaxCharLengthRef.current.forEach((nodeWithAlertsRef) => {
        let absolutePositionOfFirstCharOfNode = 0;

        for (
          let index = lowestIndex;
          index < nodeWithAlertsRef.index;
          index++
        ) {
          absolutePositionOfFirstCharOfNode +=
            elementEvaluation.snapshotItem(index)?.textContent?.length || 0;
          absolutePositionOfFirstCharOfNode += 1;
        }

        const alertsRelevantToNode = alerts.filter((alert: IAlert) =>
          elementEvaluation
            .snapshotItem(nodeWithAlertsRef.index)
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
              nodeWithAlertsRef.index
            ) as Node, //possibly null
            alerts: updatedAlerts,
            nodeIndex: nodeWithAlertsRef.index,
          });
      });
    } else {
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

          if (nodesWhithinMaxCharLengthRef.current.length == 0) {
            const nextText: string = isGoogleDocs()
              ? getInputText(cloneRef.current)
              : getInputText(element);
            if (nextText.charAt(textEndAbsPosition + 1).match(/\n/gi)) {
              textEndAbsPosition += 1;
            }
          }

          textStartingAbsPosition = textEndAbsPosition + 1;
          textEndAbsPosition =
            nodesWhithinMaxCharLengthRef.current.length == 0
              ? textStartingAbsPosition + node.nodeValue.length - 1 //needed to keep highlights in place
              : textStartingAbsPosition + node.nodeValue.length;

          const alertsTemp: IAlert[] = alerts
            .filter(
              (alert: IAlert) =>
                node.nodeValue && node.nodeValue.includes(alert.data.text)
            )
            .filter(
              (alert: IAlert) =>
                alert.startOffset >= textStartingAbsPosition &&
                alert.endOffset <= textEndAbsPosition
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
    const node = popoverData?.node as Node;
    const alert = selectedAlert as IAlert;

    if (isTextArea(element) || isInputText(element)) {
      element.selectionStart =
        alternative == ' ' && alert.startOffset !== 0
          ? alert.startOffset - 1
          : alert.startOffset;
      element.selectionEnd =
        alternative == ' ' ? alert.endOffset + 1 : alert.endOffset;
      //execCommand IS DEPRECATED, but its the only way to enable undo/redo for now
      getActiveDocument().execCommand('insertText', false, alternative);
    } else {
      const range = getActiveDocument().createRange();

      range.setStart(
        node,
        alternative == ' ' && alert.startOffset !== 0
          ? alert.startOffset - 1
          : alert.startOffset
      );
      range.setEnd(
        node,
        alternative == ' ' ? alert.endOffset + 1 : alert.endOffset
      );
      const sel = getActiveDocument().getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);

      if (isCkeEditor(element)) {
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
    if (!isCkeEditor(element) && !isGoogleDocs()) {
      setTextToCheck(getInputText(element));
      const event = new Event('keyup', { bubbles: true });
      element.dispatchEvent(event);
    }
  };

  useEffect(() => {
    if (checkEndpointError?.status === 422) {
      setNodesWithAlerts([]);
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
    log(
      `API Error Status Code ${checkEndpointError?.status}: ${checkEndpointError?.message}`,
      logTypes.ERROR
    );
  }, [checkEndpointError, authErrorResponse]);

  const logOut = () => {
    storeInLocalStorage(StorageKeys.APP_ID, getRandomToken());
    storeInLocalStorage(StorageKeys.USER_ID, '');
    storeInLocalStorage(StorageKeys.ID_WAS_ALIASED, false);
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, '');
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, '');
    addLoginBadge();
  };

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
      <WTags.WW_ACTIVITY_INDICATOR>
        <StateIndicatorIcon
          element={element}
          elementRect={elementRect}
          iconType={activeIcon}
          isHovered={isHovered}
        />
      </WTags.WW_ACTIVITY_INDICATOR>
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
      {isGoogleDocs() && !isActive && (
        <WTags.WW_HIGHLIGHTS>
          <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
            <Highlights
              elementScroll={elementScroll}
              nodesWithAlerts={nodesWithAlerts}
              element={element}
              elementRect={elementRect}
              selectedAlert={popoverData && popoverData.alert}
              userIsSignedIn={userIsSignedIn}
            />
          </Sentry.ErrorBoundary>
        </WTags.WW_HIGHLIGHTS>
      )}
      {!isGoogleDocs() && (
        <WTags.WW_HIGHLIGHTS>
          <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
            <Highlights
              elementScroll={elementScroll}
              nodesWithAlerts={nodesWithAlerts}
              element={element}
              elementRect={elementRect}
              selectedAlert={selectedAlert}
              userIsSignedIn={userIsSignedIn}
            />
          </Sentry.ErrorBoundary>
        </WTags.WW_HIGHLIGHTS>
      )}
    </>
  );
};

export default Input;
