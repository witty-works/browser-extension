import React, { useState, useEffect } from 'react';

import TextAreaClone from './TextAreaClone';
import InputTextClone from './InputTextClone';
import Highlights, { ScrollPos } from './Highlights';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { DEV_ENV } from '../shared/constants';
import {
  CustomInputElement,
  IAlert,
  IAlertContentData,
  INodeWithAlerts,
} from '../shared/types';
import { fixLineBreaks, isTextArea, isInputText } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Modal, { ModalData } from '../shared/components/Modal/Modal';

type HandleClick = () => void;

const Input: React.FC<{ element: CustomInputElement }> = ({ element }) => {
  const [loading, checkEndpointResponse, checkEndpointError, sendText] =
    useCheckEndpoint();
  const [alerts, setAlerts] = useState<IAlert[]>([]);

  const [nodesWithAlerts, setNodesWithAlerts, nodesWithAlertsRef] = useStateRef(
    [] as INodeWithAlerts[]
  );
  // const [clone, setClone] = useState<HTMLDivElement>();
  const [clone, setClone, cloneRef] = useStateRef({} as HTMLDivElement);
  const elementRect = useResizeObserver(element);
  const [elementScroll, setElementScroll] = useState<ScrollPos>({
    top: 0,
    left: 0,
  } as ScrollPos);
  const [modalData, setModalData] = useState<ModalData>({} as ModalData);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The turn around (at least for the moment) is to use 'keyup'
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('scroll', handleScrollEvent, true);
    element.addEventListener('click', handleClickElement);
    return () => {
      //Don't forget to remove the listeners at the end
      element.removeEventListener('keyup', handleKeyupEvent);
      element.removeEventListener('scroll', handleScrollEvent);
      element.removeEventListener('click', handleClickElement);
    };
  }, []);

  const handleKeyupEvent = (event: Event) => {
    const target = event.target as CustomInputElement;

    const text: string =
      isTextArea(target) || isInputText(target)
        ? (target as HTMLTextAreaElement | HTMLInputElement).value
        : fixLineBreaks(target.innerText);

    sendText(text);
  };

  const handleScrollEvent = (event: Event) => {
    //TODO add throttle
    const target = event.target as CustomInputElement;
    setElementScroll({ top: target.scrollTop, left: target.scrollLeft });
  };

  const handleClickElement = (event: Event) => {
    const target = event.target as CustomInputElement;
    const caretPosition: number = getInputClickedPosition(target);

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
        const selectedAlert = oneNodeWithAlerts.alerts.find((alert: IAlert) => {
          return (
            alert.startOffset < caretPosition && alert.endOffset > caretPosition
          );
        }) as IAlert;

        const nodeText = oneNodeWithAlerts.node;

        if (selectedAlert) {
          const range = document.createRange();
          range.setStart(nodeText, selectedAlert.startOffset);
          range.setEnd(nodeText, selectedAlert.endOffset);
          const clickedRect = range.getClientRects()[0];

          setModalData({
            alert: selectedAlert,
            position: clickedRect,
            node: oneNodeWithAlerts.node,
            originalNode:
              isTextArea(target) || isInputText(target)
                ? (target as HTMLTextAreaElement)
                : null,
          });
          toggleModal();
        }
      }
    }
  };

  const getInputClickedPosition = (element: CustomInputElement): number => {
    if (isTextArea(element) || isInputText(element)) {
      return (element as HTMLTextAreaElement | HTMLInputElement)
        .selectionStart as number;
    } else {
      const selection: Selection | null = document.getSelection();

      if (selection !== null) {
        //Modify is a non-standard feature, although currently is supported by all browsers except IE
        //https://developer.mozilla.org/en-US/docs/Web/API/Selection/modify

        //TODO In order to remove error from typescript we can augment the interface
        //https://github.com/Microsoft/TypeScript/issues/12296
        //Temporaly ignore this error
        // @ts-ignore
        selection.modify('extend', 'backward', 'paragraph');
        const position = selection.toString().length as number;
        if (selection.anchorNode != undefined) selection.collapseToEnd();
        return position;
      } else return -1;
    }
  };

  useEffect(() => {
    if (checkEndpointResponse) {
      const alerts: IAlert[] = checkEndpointResponse.results
        .map((result: any) => ({
          //TODO specify this 'any' type on the line before
          id: `${result.category}-${result.text}-${result.start}-${result.end}`,
          startOffset: result.start,
          endOffset: result.end,
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
          } as IAlertContentData,
        }))
        .sort((firstAlert: IAlert, secondAlert: IAlert) => {
          return firstAlert.startOffset < secondAlert.startOffset ? -1 : 1;
        });

      setAlerts([...alerts]);
    }
  }, [checkEndpointResponse]);

  useEffect(() => {
    if (alerts.length > 0) {
      const filteredAlerts: IAlert[] = alerts.filter((alert: IAlert) => {
        return !ignoredTerms.includes(alert.data.text);
      });

      if (isTextArea(element) || isInputText(element))
        setNodesWithAlerts([
          {
            node: clone?.firstChild,
            alerts: filteredAlerts.map((alert: IAlert) => ({
              ...alert,
              originalStartOffset: alert.startOffset,
              originalEndOffset: alert.endOffset,
            })),
          },
        ]);
      else {
        const nodesWithAlertsTemp: INodeWithAlerts[] =
          getNodesWithRecalculatedAlerts(element.childNodes, filteredAlerts);
        setNodesWithAlerts(nodesWithAlertsTemp);
      }
    }
  }, [alerts]);

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
                  originalStartOffset: alert.startOffset,
                  originalEndOffset: alert.endOffset,
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
    if (checkEndpointError.detail && checkEndpointError.detail.length > 0) {
      if (DEV_ENV) console.log('API Error = ', checkEndpointError);
      if (checkEndpointError.detail === 'Language could not be determined')
        setNodesWithAlerts([]);
    }
  }, [checkEndpointError]);

  const updateCloneData = (clone: HTMLDivElement) => {
    setClone(clone);
  };

  const toggleModal: HandleClick = () => {
    setIsOpen(!isOpen);
  };

  const resendText = () => {
    const text: string =
      isTextArea(element) || isInputText(element)
        ? (element as HTMLTextAreaElement | HTMLInputElement).value
        : fixLineBreaks(element.innerText);

    sendText(text);
  };

  const addIgnoredTerm = (term: string): void => {
    setIgnoredTerms([...ignoredTerms, term]);
    setAlerts([...alerts]);
  };

  return (
    <div className='canvas-container'>
      {isTextArea(element) ? (
        <TextAreaClone
          element={element as HTMLTextAreaElement}
          elementRect={elementRect}
          elementScroll={elementScroll}
          updateClone={updateCloneData}
        />
      ) : null}
      {isInputText(element) ? (
        <InputTextClone
          element={element as HTMLInputElement}
          elementRect={elementRect}
          updateClone={updateCloneData}
        />
      ) : null}
      {loading ? <HighlightsLoader elementReference={element} /> : null}
      {nodesWithAlerts.length > 0 ? (
        <Highlights
          elementScroll={elementScroll}
          elementRect={elementRect}
          nodesWithAlerts={nodesWithAlerts}
        />
      ) : null}
      {modalData.alert ? (
        <Modal
          isOpen={isOpen}
          data={modalData}
          hide={toggleModal}
          resendText={resendText}
          addIgnoredTerm={addIgnoredTerm}
        />
      ) : null}
    </div>
  );
};

export default Input;
