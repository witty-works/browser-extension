import React, { useState, useEffect } from 'react';
import TextAreaClone from './TextAreaClone';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import {
  CustomInputElement,
  IAlert,
  INodeWithAlerts,
  ScrollPos,
} from '../shared/types';
import { fixLineBreaks, isTextArea, isInputText } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { throttle } from 'lodash';
import HighlightPopover, {
  PopoverData,
} from './HighlightPopover/HighlightPopover';
import InputTextClone from './InputTextClone';
import Highlights from './Highlights';

const Input: React.FC<{
  element: CustomInputElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
}> = ({ element, bodyScroll, parentScroll }) => {
  const [loading, checkEndpointResponse, checkEndpointError, setTextToCheck] =
    useCheckEndpoint();
  const analytics = useAnalytics();
  const elementRect = useResizeObserver(element);

  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [elementScroll, setElementScroll] = useState<ScrollPos>({
    top: 0,
    left: 0,
  } as ScrollPos);
  const [popoverData, setPopoverData] = useState<PopoverData>(
    {} as PopoverData
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);

  const [nodesWithAlerts, setNodesWithAlerts, nodesWithAlertsRef] = useStateRef(
    [] as INodeWithAlerts[]
  );
  const [clone, setClone, cloneRef] = useStateRef({} as HTMLDivElement);
  const [selectedAlert, setSelectedAlert] = useState<IAlert | null>(null);

  const log = useLog('Input');

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'
    handleKeyupEvent();
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleKeyupEvent);
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
      element.removeEventListener('keyup', handleKeyupEvent);
      element.removeEventListener('focusin', handleKeyupEvent);
      element.removeEventListener('scroll', handleElementScrollEvent);
      element.removeEventListener(
        'click',
        handleElementClickEvent as EventListener
      );
      if (parentForm)
        parentForm.removeEventListener('submit', handleSubmitFormEvent);
    };
  }, []);

  const handleKeyupEvent = throttle(() => {
    const nextText: string =
      isTextArea(element) || isInputText(element)
        ? element.value
        : fixLineBreaks(element.innerText);

    //If there isn't text, there's nothing to highlight
    if (nextText.length === 0 || !nextText.match(/[a-z0-9]/i))
      setNodesWithAlerts([]);
    else {
      setTextToCheck(nextText);
    }
  }, 3000);

  const handleElementScrollEvent = throttle(() => {
    setElementScroll({ top: element.scrollTop, left: element.scrollLeft });
  }, 500);

  const handleSubmitFormEvent = () => {
    //It's assumed that when user sends info through a form, text will disappear.
    //Therefore highlights also need to be removed
    setNodesWithAlerts([]);
  };

  const updateCloneData = (newClone: HTMLDivElement) => {
    setClone(newClone);
  };

  const togglePopover = (): void => {
    setIsPopoverOpen(!isPopoverOpen);
    if (isPopoverOpen) {
      analytics.popoverToggleLog(popoverData.alert);
      setSelectedAlert(null);
    }
  };

  const resendText = () => {
    const text: string =
      isTextArea(element) || isInputText(element)
        ? element.value
        : fixLineBreaks(element.innerText);

    setTextToCheck(text);
  };

  const addIgnoredTerm = (term: string): void => {
    setIgnoredTerms([...ignoredTerms, term]);
  };

  let singleClickTimeOut: ReturnType<typeof setTimeout>;

  const handleElementClickEvent = (event: MouseEvent) => {
    if (event.detail === 1) {
      singleClickTimeOut = setTimeout(function () {
        if (caretPosition > -1) {
          const nodeAlerts = nodesWithAlertsRef.current;

          const oneNodeWithAlerts = nodeAlerts.find(
            (nodeWithAlerts: INodeWithAlerts) =>
              //TODO potentially this acces to parentNode could fail
              isTextArea(target) || isInputText(target)
                ? nodeWithAlerts.node.parentNode === cloneRef.current
                : nodeWithAlerts.node.parentNode === target
          );

          if (oneNodeWithAlerts) {
            const selectedAlert = oneNodeWithAlerts.alerts
              .filter((alert: IAlert) => {
                return (
                  alert.startOffset < caretPosition &&
                  alert.endOffset > caretPosition
                );
              })
              .pop() as IAlert;

            const nodeText = oneNodeWithAlerts.node;

            if (selectedAlert) {
              const range = document.createRange();
              range.setStart(nodeText, selectedAlert.startOffset);
              range.setEnd(nodeText, selectedAlert.endOffset);
              const clickedRect = range.getClientRects()[0];

              setPopoverData({
                alert: selectedAlert,
                position: clickedRect,
                node: oneNodeWithAlerts.node,
                originalNode:
                  isTextArea(target) || isInputText(target) ? target : null,
              });

              setSelectedAlert(selectedAlert);
              togglePopover();
            }
          }
        }
      }, 400);
    } else {
      clearTimeout(singleClickTimeOut);
    }

    const target = event.target as CustomInputElement;
    const caretPosition: number = getInputClickedPosition(target);
  };

  const getInputClickedPosition = (element: CustomInputElement): number => {
    if (isTextArea(element) || isInputText(element)) {
      return element.selectionStart as number;
    } else {
      const selection: Selection | null = document.getSelection();
      return selection ? selection.anchorOffset : -1;
    }
  };

  useEffect(() => {
    if (!checkEndpointResponse) return;
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
        id: `${result.category}-${result.text}-${result.start}-${result.end}`,
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
          reason: result.reason,
          solution: result.solution,
          alternatives: result.alternatives,
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
      const filteredAlerts: IAlert[] = alerts.filter((alert: IAlert) => {
        return !ignoredTerms.includes(alert.data.text);
      });
      if (isTextArea(element) || isInputText(element)) {
        if (!clone.firstChild) {
          return;
        }
        setNodesWithAlerts([
          {
            node: clone.firstChild,
            alerts: filteredAlerts.map((alert: IAlert) => ({
              ...alert,
            })),
          },
        ]);
      } else {
        const nodesWithAlertsTemp: INodeWithAlerts[] =
          getNodesWithRecalculatedAlerts(element.childNodes, filteredAlerts);
        setNodesWithAlerts(nodesWithAlertsTemp);
      }
    }
  }, [alerts, ignoredTerms, clone]);

  const getNodesWithRecalculatedAlerts = (
    nodes: NodeListOf<ChildNode>,
    alerts: IAlert[]
  ) => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];
    let textStartingAbsPosition: number = 0;
    let textEndAbsPosition: number = 0;

    const traverseNodes = (nodes: NodeListOf<ChildNode>) => {
      for (let node of nodes) {
        textStartingAbsPosition = textEndAbsPosition;

        if (node.nodeName === '#text') {
          if (node.nodeValue) {
            const nodeValueLength = node.nodeValue.length;
            textEndAbsPosition = textStartingAbsPosition + nodeValueLength;

            const alertsTemp: IAlert[] = alerts
              .filter(
                (alert: IAlert) =>
                  alert.startOffset >= textStartingAbsPosition &&
                  alert.endOffset <= textEndAbsPosition
              )
              .map((alert: IAlert) => {
                const newAlert: IAlert = {
                  ...alert,
                  startOffset: alert.startOffset - textStartingAbsPosition,
                  endOffset: alert.endOffset - textStartingAbsPosition,
                };

                return newAlert;
              });

            nodesWithAlertsTemp.push({
              node: node as HTMLElement,
              alerts: alertsTemp,
            });
          }
        } else {
          if (node.previousSibling !== null) {
            if (node.nodeName === 'DIV' || 'BR' || 'P') textEndAbsPosition++;
          }
          if (node.childNodes.length > 0) {
            traverseNodes(node.childNodes);
          }
        }
      }
    };
    traverseNodes(nodes);
    return nodesWithAlertsTemp;
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
      {loading && <HighlightsLoader elementReference={element} />}
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
      {popoverData.alert && isPopoverOpen && (
        <HighlightPopover
          element={element}
          data={popoverData}
          hide={togglePopover}
          resendText={resendText}
          addIgnoredTerm={addIgnoredTerm}
        />
      )}
      <Highlights
        bodyScroll={bodyScroll}
        parentScroll={parentScroll}
        elementScroll={elementScroll}
        elementRect={elementRect}
        nodesWithAlerts={nodesWithAlerts}
        element={element}
        selectedAlert={selectedAlert}
      />
    </div>
  );
};

export default Input;
