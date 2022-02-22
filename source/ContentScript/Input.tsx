import React, { useState, useEffect } from 'react';
import TextAreaClone from './TextAreaClone';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import {
  CustomInputElement,
  IAlert,
  INodeWithAlerts,
  ScrollPos,
} from '../shared/types';
import { /* fixLineBreaks,  */ isTextArea, isInputText } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { debounce } from 'lodash';
import HighlightPopover, {
  PopoverData,
} from './HighlightPopover/HighlightPopover';
import InputTextClone from './InputTextClone';
import Highlights from './Highlights';
import WittySupportIcon from './WittySupportsIcon';

const Input: React.FC<{
  element: CustomInputElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
}> = ({ element, bodyScroll, parentScroll }) => {
  const [, checkEndpointResponse, checkEndpointError, setTextToCheck] = //TODO: add back loading
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
  const [wittySupportIcon, setWittySupportIcon] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const log = useLog('Input');

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'
    handleKeyupEvent();
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleKeyupEvent);
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
      element.removeEventListener('keyup', handleKeyupEvent);
      element.removeEventListener('focusin', handleKeyupEvent);
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

  const handleMouseoverEvent = () => {
    setIsHovered(true);
  };

  const handleMouseoutEvent = () => {
    setIsHovered(false);
  };

  const handleFocusoutEvent = () => {
    const nextText: string =
      isTextArea(element) || isInputText(element)
        ? element.value
        : element.innerText;
    if (nextText == '\n' || nextText.length == 0) setWittySupportIcon(false);
  };

  const handleKeyupEvent = (event?: Event) => {
    setWittySupportIcon(true);

    console.log('element text', element.innerHTML);

    const nextText: string =
      isTextArea(element) || isInputText(element)
        ? element.value
        : element.innerText.replaceAll(/\n{2,}/g, '\n');
    // .replaceAll(/\u00A0(?:\n+)/g, '')
    // .trim();

    console.log('nextText', nextText);

    //If there isn't text, there's nothing to highlight
    if (nextText.length === 0 || !nextText.match(/[a-zA-Z0-9.:;,?!]/i)) {
      setNodesWithAlerts([]);
      setTextToCheck('');
    } else {
      console.log('we have text that needs to be send');

      // Always create a new string, to force change the state of setTextToCheck
      const newNextText: string = new String(nextText) as string;

      event && event.type == 'focusin'
        ? setTextToCheck(newNextText)
        : debouncedSetTextToCheck(newNextText);
    }
  };

  const debouncedSetTextToCheck = debounce((nextText: string) => {
    setTextToCheck(nextText);
  }, 3000);

  const handleElementScrollEvent = debounce(() => {
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
    // const text: string =
    //   isTextArea(element) || isInputText(element)
    //     ? element.value
    //     : fixLineBreaks(element);
    // setTextToCheck(text);
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
        id: `${result.text}-${result.category}`,
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

      let nodesWithAlertsTemp: INodeWithAlerts[] = [];

      if (isTextArea(element) || isInputText(element)) {
        if (!clone.firstChild) {
          return;
        }
        nodesWithAlertsTemp.push({
          node: clone.firstChild,
          alerts: filteredAlerts.map((alert: IAlert) => ({
            ...alert,
          })),
        });
      } else {
        // const nodesWithAlertsTemp: INodeWithAlerts[] =
        //   getNodesWithRecalculatedAlerts(element.childNodes, filteredAlerts);

        nodesWithAlertsTemp =
          getNodesWithRecalculatedPositionAlerts(filteredAlerts);
      }
      console.log('nodesWithAlertsTemp FINAL', nodesWithAlertsTemp);

      setNodesWithAlerts(nodesWithAlertsTemp);
      // setNodesWithAlerts([]);
    }
  }, [alerts, ignoredTerms, clone]);

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[]
  ): INodeWithAlerts[] => {
    console.log('alerts', alerts);

    const nodesWithAlertsTemp: INodeWithAlerts[] = [];

    const nextText: string =
      isTextArea(element) || isInputText(element)
        ? element.value
        : element.innerText.replaceAll(/\n{2,}/g, '\n');
    // .replaceAll(/\u00A0(?:\n+)/g, '')
    // .trim();

    let textStartingAbsPosition: number = 0;
    let textEndAbsPosition: number = 0;

    const elementEvaluation: XPathResult = document.evaluate(
      //'.//*[text()]',
      // './/*[child::text() and not(child::span or div)]',
      './/text()',
      // './/*[text()]',
      element,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    // const nodes: Node[] = [];

    // for (let index = 0; index < elementEvaluation.snapshotLength; index++) {
    //   const node = elementEvaluation.snapshotItem(index) as Node;
    //   console.log('node', node);
    //   console.log('node parentElement', node.parentElement);
    //   /* console.log('node.childNodes', node.childNodes);
    //   if (node.childNodes.length > 1) {
    //     node.childNodes.forEach((node: Node) => {
    //       if (node.nodeName !== '#text' && node.nodeValue !== '') {
    //         nodes.push(node);
    //       }
    //     });
    //   } */
    //   nodes.push(node);
    // }

    // console.log('nodes', nodes);

    for (let index = 0; index < elementEvaluation.snapshotLength; index++) {
      const node = elementEvaluation.snapshotItem(index) as Node;
      console.log('> node', node);

      if (
        node.nodeValue &&
        node.nodeValue.match(/(\u00A0)|[a-zA-Z0-9.:;,?!]/i)
      ) {
        console.log('> we have some relevant text:', node.nodeValue);

        textStartingAbsPosition = textEndAbsPosition;
        console.log('textStartingAbsPosition', textStartingAbsPosition);

        const nodeValueLength: number = node.nodeValue.length as number;
        console.log('nodeValueLength', nodeValueLength);

        const afterChar: string = nextText.slice(
          textStartingAbsPosition + nodeValueLength,
          textStartingAbsPosition + nodeValueLength + 1
        );

        console.log('after char', afterChar);

        //&nbsp;
        if (afterChar.match(/\s/gi)) {
          // if (afterChar.match(/\s|(&nbsp;)/gi)) {
          console.log('has a space after the word');
          textEndAbsPosition = textStartingAbsPosition + nodeValueLength + 1;
        } else {
          console.log('NO space after the word');
          textEndAbsPosition = textStartingAbsPosition + nodeValueLength;
        }

        console.log('textEndAbsPosition', textEndAbsPosition);

        const alertsTemp: IAlert[] = alerts
          .filter((alert: IAlert) => {
            console.log('compi alert.data.text', alert.data.text);

            const compi =
              node.nodeValue && node.nodeValue.includes(alert.data.text);
            console.log('compi', compi);

            return compi;
          })
          .filter((alert: IAlert) => {
            console.log('alert data text', alert.data.text);
            console.log(
              'alert.startOffset >= textStartingAbsPosition',
              alert.startOffset,
              textStartingAbsPosition
            );
            console.log(
              'alert.endOffset <= textEndAbsPosition',
              alert.endOffset,
              textEndAbsPosition
            );
            return (
              alert.startOffset >= textStartingAbsPosition &&
              alert.endOffset <= textEndAbsPosition
            );
          })
          .map((alert: IAlert) => {
            // console.log('alert', alert);

            const newAlert: IAlert = {
              ...alert,
              startOffset: alert.startOffset - textStartingAbsPosition,
              endOffset: alert.endOffset - textStartingAbsPosition,
            };

            return newAlert;
          });

        // console.log('alertsTemp', alertsTemp);

        if (alertsTemp.length > 0) {
          nodesWithAlertsTemp.push({
            node: node,
            alerts: alertsTemp,
          });
        }
      }
    }

    console.log('nodesWithAlertsTemp', nodesWithAlertsTemp);

    return nodesWithAlertsTemp;
  };

  /* const getNodesWithRecalculatedAlerts = (
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
  }; */

  useEffect(() => {
    if (checkEndpointError)
      log(
        `API Error Status Code ${checkEndpointError.status}: ${checkEndpointError.message}`,
        logTypes.ERROR
      );
  }, [checkEndpointError]);

  return (
    <div className='canvas-container'>
      {/* TODO: use loading state for animation */}
      {wittySupportIcon ? (
        <WittySupportIcon elementReference={element} active={true} />
      ) : (
        isHovered && (
          <WittySupportIcon elementReference={element} active={false} />
        )
      )}
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
