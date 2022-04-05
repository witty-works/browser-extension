import React, { useState, useEffect, useCallback } from 'react';

import defaultConfig from '../witty.config.json';
import TextAreaClone from './TextAreaClone';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import {
  CustomInputElement,
  IAlert,
  INodeWithAlerts,
  ScrollPos,
} from '../shared/types';
import { isTextArea, isInputText } from '../shared/utils';
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
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';

const Input: React.FC<{
  element: CustomInputElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
}> = ({ element, bodyScroll, parentScroll }) => {
  const [checkEndpointResponse, checkEndpointError, setTextToCheck] =
    useCheckEndpoint();
  const analytics = useAnalytics();
  let elementRect = useResizeObserver(element);
  let elementOffsetParentRect = useResizeObserver(
    element.offsetParent as HTMLElement
  );

  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [observedElement, setObservedElement] = useState<HTMLElement>(element);
  const [observedElementRect, setObservedElementRect] = useState<DOMRect>(
    element.getBoundingClientRect()
  );
  const [elementScroll, setElementScroll] = useState<ScrollPos>({
    top: 0,
    left: 0,
  } as ScrollPos);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);

  const [nodesWithAlerts, setNodesWithAlerts, nodesWithAlertsRef] = useStateRef(
    [] as INodeWithAlerts[]
  );
  const [clone, setClone, cloneRef] = useStateRef({} as HTMLDivElement);
  const [selectedNodeWithAlertsIndex, setSelectedNodeWithAlertsIndex] =
    useState<number>(-1);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState<number>(-1);
  const [selectedAlert, setSelectedAlert] = useState<IAlert | null>(null);
  const [popoverData, setPopoverData] = useState<PopoverData | null>(null);
  const [activeIcon, setActiveIcon, activeIconRef] = useStateRef('active');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [elementXPathResult, setElementXPathResult] = useState<XPathResult>();
  const [debounceDelay, setDebounceDelay] = useState<number>(
    defaultConfig.API_DELAY
  );

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

  const log = useLog('Input');

  useEffect(() => {
    browser.storage.local.get(StorageKeys.API_DELAY).then((result) => {
      setDebounceDelay(result[StorageKeys.API_DELAY] as number);
    });

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
    docTextEvaluation(element);
  }, [element]);

  useEffect(() => {
    const ele: { element: HTMLElement; rect: DOMRect } =
      elementOffsetParentRect.width < elementRect.width ||
      elementOffsetParentRect.height < elementRect.height
        ? {
            element: element.offsetParent as HTMLElement,
            rect: elementOffsetParentRect,
          }
        : { element: element, rect: elementRect };

    setObservedElement(ele.element);
    setObservedElementRect(ele.rect);
  }, [elementRect, elementOffsetParentRect]);

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
    const nextText: string = getInputText(element);
    if (nextText == '\n' || nextText.length == 0) setActiveIcon('passive');
  };

  const handleKeyupEvent = (event?: Event) => {
    browser.storage.local.get(StorageKeys.SPELL_CHECKING).then((result) => {
      element.spellcheck = !result[StorageKeys.SPELL_CHECKING];
    });
    const nextText: string = getInputText(element);
    handleTextAndIcon(nextText, event);
  };

  const handleTextAndIcon = (text: string, event?: Event) => {
    //If there isn't text, there's nothing to highlight
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
  const handleElementScrollEvent = debounce(() => {
    setElementScroll({ top: element.scrollTop, left: element.scrollLeft });
  }, 500);

  const handleSubmitFormEvent = () => {
    //It's assumed that when user sends info through a form, text will disappear.
    //Therefore highlights also need to be removed
    setNodesWithAlerts([]);
  };

  const docTextEvaluation = (element: HTMLElement) => {
    //Find the text nodes inside element
    const elementEvaluation: XPathResult = document.evaluate(
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

  const hidePopover = () => {
    if (popoverData) {
      setPopoverData(null);
      setSelectedAlert(null);
      setSelectedNodeWithAlertsIndex(-1);
      setSelectedAlertIndex(-1);
    }
  };

  const getInputText = (element: CustomInputElement) =>
    isTextArea(element) || isInputText(element)
      ? element.value
      : element.innerText.replaceAll(/^\n+/g, '').replaceAll(/\n{2,}/g, '\n');

  const addIgnoredTerm = (term: string): void => {
    setIgnoredTerms([...ignoredTerms, term]);
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
                position: (document.getSelection() as Selection).anchorOffset,
                element: (document.getSelection() as Selection).anchorNode,
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
            // If so, then find out if an alert that has been clicked
            const selectedAlertIndex = oneNodeWithAlerts.alerts.findIndex(
              (alert: IAlert) => {
                const caretPos = caret.position as number;
                //If alert is a one character word, take in consideration clicking the position before or after the char
                return alert.data.text.length === 1
                  ? alert.startOffset <= caretPos && alert.endOffset >= caretPos
                  : alert.startOffset < caretPos && alert.endOffset > caretPos;
              }
            );

            if (selectedAlertIndex > -1)
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
    if (
      nodesWithAlertsRef.current.length > 0 &&
      selectedNodeWithAlertsIndex > -1 &&
      selectedAlertIndex > -1
    ) {
      const oneNodeWithAlerts =
        nodesWithAlertsRef.current[selectedNodeWithAlertsIndex];

      const selectedAlert = oneNodeWithAlerts.alerts[selectedAlertIndex];

      setSelectedAlert(selectedAlert);

      const range = document.createRange();
      const nodeText = oneNodeWithAlerts.node;
      range.setStart(nodeText, selectedAlert.startOffset);
      range.setEnd(nodeText, selectedAlert.endOffset);
      const clickedRect = range.getClientRects()[0];

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
    setActiveIcon('active');
    analytics.checkLog(
      checkEndpointResponse,
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
      const alertsWithoutIgnoredTerms: IAlert[] = alerts.filter(
        (alert: IAlert) => !ignoredTerms.includes(alert.data.text)
      );

      const whereMinGravity = (alert0: IAlert, ...alerts: IAlert[]): IAlert => {
        return [alert0, ...alerts]
          .filter(Boolean)
          .reduce((minAlert, currentAlert) =>
            (minAlert.data.gravity || Infinity) <
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
  }, [alerts, ignoredTerms, elementXPathResult]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[],
    elementEvaluation: XPathResult
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];

    const nextText: string = getInputText(element);

    let textStartingAbsPosition: number = 0;
    let textEndAbsPosition: number = 0;

    for (let index = 0; index < elementEvaluation.snapshotLength; index++) {
      const node = elementEvaluation.snapshotItem(index) as Node;

      if (
        node.nodeValue &&
        node.nodeValue.match(/(\u00A0)|[a-zA-Z0-9.:;,?!]/i)
      ) {
        textStartingAbsPosition = textEndAbsPosition;

        const nodeValueLength: number = node.nodeValue.length;

        textEndAbsPosition = textStartingAbsPosition + nodeValueLength;
        // Check if there is a whitespace char after the node's content
        // If so, we +1 to the end position
        if (nextText.charAt(textEndAbsPosition).match(/\n/gi))
          textEndAbsPosition += 1;

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
    const nodeText: string = node.nodeValue as string;
    const alert = selectedAlert as IAlert;
    const termToBeReplaced: string = nodeText.slice(
      alert.startOffset,
      alert.endOffset
    );

    const regex: RegExp = new RegExp(
      alternative === ''
        ? alert.startOffset === 0
          ? `${termToBeReplaced}[ ,]?`
          : `(?<=(.|\n){${alert.startOffset}})${termToBeReplaced}[ ,]?`
        : alert.startOffset === 0
        ? `${termToBeReplaced}`
        : `(?<=(.|\n){${alert.startOffset}})${termToBeReplaced}`
    );

    const newTextToInsert = nodeText.replace(regex, alternative);

    isTextArea(element) || isInputText(element)
      ? (element.value = newTextToInsert)
      : (node.nodeValue = newTextToInsert);

    const newText: string = getInputText(element);
    setTextToCheck(newText);

    hidePopover();
  };

  useEffect(() => {
    if (checkEndpointError)
      log(
        `API Error Status Code ${checkEndpointError.status}: ${checkEndpointError.message}`,
        logTypes.ERROR
      );
  }, [checkEndpointError]);

  return (
    <div className='canvas-container'>
      <StateIndicatorIcon
        elementReference={element}
        iconType={activeIcon}
        isHovered={isHovered}
      />
      {isTextArea(element) && (
        <TextAreaClone
          element={element}
          elementRect={elementRect}
          elementScroll={elementScroll}
          updateClone={updateCloneData}
        />
      )}
      {isInputText(element) && (
        <InputTextClone
          element={element}
          elementRect={elementRect}
          updateClone={updateCloneData}
        />
      )}
      {popoverData && (
        <HighlightPopover
          element={element}
          data={popoverData}
          hide={hidePopover}
          updateTextWithAlternative={updateTextWithAlternative}
          addIgnoredTerm={addIgnoredTerm}
          movePopoverNextOrPrev={movePopoverNextOrPrev}
        />
      )}
      <Highlights
        bodyScroll={bodyScroll}
        parentScroll={parentScroll}
        elementScroll={elementScroll}
        elementRect={observedElementRect}
        nodesWithAlerts={nodesWithAlerts}
        element={observedElement}
        selectedAlert={selectedAlert}
      />
    </div>
  );
};

export default Input;
