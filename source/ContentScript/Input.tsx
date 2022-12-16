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
  getFirstTextDiff,
  addLoginBadge,
  getRandomToken,
} from '../shared/utils';
import { isTextArea, isInputText, isCkeEditor } from '../shared/DOMutils';
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
import { getInputText, updateConfig } from './utils';
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
  const [, , previousTextToCheckRef] = useStateRef('');
  const [refreshTokenResponse, refreshTokenError, setRefreshToken] =
    useRefreshTokenEndpoint();
  const [currentTextToCheck, setCurrentTextToCheck] = useState('');
  const analytics = useAnalytics();
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
  const [clone, setClone, cloneRef] = useStateRef({} as HTMLDivElement);
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
  const [ignoredCategoriesFromStorage, setIgnoredCategoriesFromStorage] =
    useState<IgnoredCategory[]>([]);
  const [userIsSignedIn, setUserIsSignedIn] = useState<boolean>(false);

  const onElementMutation = useCallback(
    (mutationsList: MutationRecord[]) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          docTextEvaluation(element);
        }
      }
    },
    [element]
  );

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

    element.addEventListener('focusout', handleFocusoutEvent);
    element.addEventListener('mouseover', handleMouseoverEvent);
    element.addEventListener('mouseout', handleMouseoutEvent);
    element.addEventListener('scroll', handleElementScrollEvent, true);
    element.addEventListener('click', handleElementClickEvent as EventListener);

    //If a parent form exists, we will monitor the submision.
    //This will allow us remove remaining highlights when text disappear
    const parentForm: HTMLFormElement | null = isTextArea(element)
      ? element.form
      : element.closest('form');

    if (parentForm)
      parentForm.addEventListener('submit', handleSubmitFormEvent);

    return () => {
      //Don't forget to remove the listeners at the end
      element.removeEventListener('focusout', handleFocusoutEvent);
      element.removeEventListener('mouseover', handleMouseoverEvent);
      element.removeEventListener('mouseout', handleMouseoutEvent);
      element.removeEventListener('scroll', handleElementScrollEvent);
      element.removeEventListener(
        'click',
        handleElementClickEvent as EventListener
      );
      if (parentForm)
        parentForm.removeEventListener('submit', handleSubmitFormEvent);
    };
  }, []);

  useEffect(() => {
    handleKeyupEvent();
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleFocusinEvent);

    return () => {
      //Don't forget to remove the listeners at the end
      element.removeEventListener('keyup', handleKeyupEvent);
      element.removeEventListener('focusin', handleFocusinEvent);
    };
  }, [debounceDelay]);

  useEffect(() => {
    if (!authResponse) return;
    updateConfig(authResponse);
  }, [authResponse]);

  useEffect(() => {
    docTextEvaluation(element);
  }, [element]);

  const handleMouseoverEvent = () => {
    if (activeIconRef.current == 'passive') setIsHovered(true);
  };

  const handleMouseoutEvent = () => {
    if (activeIconRef.current == 'passive') setIsHovered(false);
  };

  const handleFocusinEvent = (event: Event) => {
    const nextText: string = getInputText(element);
    handleTextAndIcon(nextText, event);
  };

  const handleFocusoutEvent = () => {
    setActiveIcon('passive');
    setAlerts([]);
    setTextToCheck('');
  };

  const handleKeyupEvent = (event?: Event) => {
    if (prevSelectedAlertIndex.current != -1) resetPopover();

    browser.storage.local
      .get(StorageKeys.ORTHOGRAPHY)
      .then((result) => {
        element.spellcheck = !result[StorageKeys.ORTHOGRAPHY];
      })
      .catch((error: unknown) => {
        sendErrorToSentry(error);
      });

    let nextText: string = getInputText(element);
    const fistTextDiff = getFirstTextDiff(
      previousTextToCheckRef.current,
      nextText
    );

    if (isTextArea(element)) {
      const unchangedAlerts = nodesWithAlertsRef.current.map((nodeWithAlerts) =>
        nodeWithAlerts.alerts.filter(
          (alert) => alert.startOffset < fistTextDiff
        )
      );
      if (unchangedAlerts[0]) setAlerts(unchangedAlerts[0]);
    } else {
      const nextTextAtFistTextDiff = nextText.substring(
        fistTextDiff,
        nextText.length
      );

      if (nextTextAtFistTextDiff.length > 3) {
        setAlerts([]);
      }
    }

    previousTextToCheckRef.current = nextText;

    handleTextAndIcon(nextText, event);
  };

  const handleTextAndIcon = (text: string, event?: Event) => {
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
    setElementScroll({ top: element.scrollTop, left: element.scrollLeft });
  };

  const handleSubmitFormEvent = () => {
    //It's assumed that when user sends info through a form, text will disappear.
    //Therefore highlights also need to be removed
    setNodesWithAlerts([]);
  };

  const docTextEvaluation = (element: HTMLElement) => {
    //Find the text nodes inside element
    const elementEvaluation: XPathResult = getActiveDocument().evaluate(
      './/text()',
      element,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    setElementXPathResult(elementEvaluation);
  };

  const updateCloneData = (newClone: HTMLDivElement) => {
    setClone(newClone);
  };

  const resetPopover = () => {
    setPopoverData(null);
    setSelectedAlert(null);
    setSelectedNodeWithAlertsIndex(-1);
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

            let selectedAlertIndex = oneNodeWithAlerts.alerts.findIndex(
              (alert: IAlert) => {
                //If alert is a one character word, take in consideration clicking the position before or after the char
                return alert.data.text.length === 1
                  ? alert.startOffset <= caretPos && alert.endOffset >= caretPos
                  : alert.startOffset < caretPos && alert.endOffset > caretPos;
              }
            );

            const selectedAlerts = oneNodeWithAlerts.alerts.filter(
              (alert: IAlert) =>
                alert.startOffset <= caretPos && alert.endOffset >= caretPos
            );
            if (selectedAlerts.length > 1) {
              const alertWithLargestStartoffset = selectedAlerts.reduce(
                (prev: IAlert, current: IAlert) => {
                  return prev.startOffset > current.startOffset
                    ? prev
                    : current;
                }
              );

              selectedAlertIndex = oneNodeWithAlerts.alerts.findIndex(
                (alert: IAlert) =>
                  alert.startOffset === alertWithLargestStartoffset.startOffset
              );
            }

            if (selectedAlertIndex === -1) return;
            if (prevSelectedAlertIndex.current === selectedAlertIndex) {
              resetPopover();
              return;
            }

            setSelectedAlertIndex(selectedAlertIndex);
          }
        }
      }, 400);
    } else {
      clearTimeout(singleClickTimeOut);
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
        (selectedAlert.endOffset > nodeText.textContent.length ||
          selectedAlert.startOffset > nodeText.textContent.length)
      )
        return;

      range.setStart(nodeText, selectedAlert.startOffset);
      range.setEnd(nodeText, selectedAlert.endOffset);
      const rect = range.getClientRects()[0];
      const clickedRect = {
        ...rect,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        x: rect.left,
        top: range.getClientRects()[0].top - elementScroll.top,
        y: range.getClientRects()[0].top - elementScroll.top,
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
                node: clone.firstChild as Node,
                alerts: alertsWithoutIgnoredTermsGravityReduced,
              },
            ]
          : getNodesWithRecalculatedPositionAlerts(
              alertsWithoutIgnoredTermsGravityReduced,
              elementXPathResult as XPathResult
            );

      //Set the total alerts
      const totalAlerts: number = nodesWithAlertsTemp.reduce(
        (total, node) => total + node.alerts.length,
        0
      );
      setTotalAlerts(totalAlerts);

      setNodesWithAlerts(nodesWithAlertsTemp);
    }
  }, [alerts, ignoredTerms, elementXPathResult, ignoredCategoriesFromStorage]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[],
    elementEvaluation: XPathResult
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];

    const nextText: string = getInputText(element);

    let textStartingAbsPosition: number = 0;
    let textEndAbsPosition: number = -1;

    for (let index = 0; index < elementEvaluation.snapshotLength; index++) {
      const node = elementEvaluation.snapshotItem(index) as Node;

      if (node.nodeValue && node.nodeValue.match(/(\u00A0)|\S/i)) {
        textStartingAbsPosition = textEndAbsPosition + 1;

        const nodeValueLength: number = node.nodeValue.length;

        textEndAbsPosition = textStartingAbsPosition + nodeValueLength - 1; //needed to keep huglights in place

        // Check if there is a new line char after the node's content
        // If so, we +1 to the end position
        if (nextText.charAt(textEndAbsPosition + 1).match(/\n/gi)) {
          textEndAbsPosition += 1;
        }

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
          });
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
      } else {
        getActiveDocument().execCommand('insertText', false, alternative);
        if (isTextArea(element)) {
          const unchangedAlerts = nodesWithAlertsRef.current.map(
            (nodeWithAlerts) =>
              nodeWithAlerts.alerts.filter(
                (nodeAlert) => nodeAlert.startOffset < alert.startOffset
              )
          );
          if (unchangedAlerts[0]) setAlerts(unchangedAlerts[0]);
        }
        setTextToCheck(getInputText(element));
        const event = new Event('keyup', { bubbles: true });
        element.dispatchEvent(event);
      }
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
    </>
  );
};

export default Input;
