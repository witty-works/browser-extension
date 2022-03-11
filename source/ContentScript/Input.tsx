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
import { isTextArea, isInputText } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { debounce } from 'lodash';
import HighlightPopover, {
  PopoverData,
} from './HighlightPopover/HighlightPopover';
import InputTextClone from './InputTextClone';
import Highlights from './Highlights';
import StateIndicatorIcon from '../shared/StateIndicatorIcons/IconController';

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

  // const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(-1);
  // const selectedNode: INodeWithAlerts | null =
  //   nodesWithAlertsRef.current[selectedNodeIndex || 0] || null;
  // const [selectedAlertIndex, setSelectedAlertIndex] = useState<number>(-1);
  // const selectedAlert: IAlert | null =
  //   (selectedNode?.alerts || [])[selectedAlertIndex || 0] || null;

  // const [target, setTarget] = useState<CustomInputElement | null>(null);
  // const range = document.createRange();
  // if (selectedNode && selectedAlert) {
  //   range.setStart(selectedNode.node, selectedAlert.startOffset);
  //   range.setEnd(selectedNode.node, selectedAlert.endOffset);
  // }
  const [selectedNodeWithAlertsIndex, setSelectedNodeWithAlertsIndex] =
    useState<number>(-1);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState<number>(-1);
  const [selectedAlert, setSelectedAlert] = useState<IAlert | null>(null);
  // const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [popoverData, setPopoverData] = useState<PopoverData | null>(null);
  const [activeIcon, setActiveIcon, activeIconRef] = useStateRef('active');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  // const [virtualAlertIndex, setVirtualAlertIndex] = useState<number>(0);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);

  // let virtualAlertIndex = selectedAlertIndex;
  // for (let i = 0; i < selectedNodeIndex; i++) {
  //   virtualAlertIndex += nodesWithAlertsRef.current[i].alerts.length;
  // }

  const log = useLog('Input');

  useEffect(() => {
    handleKeyupEvent();

    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleFocusinEvent);
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
      element.removeEventListener('focusin', handleFocusinEvent);
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

  // useEffect(() => {
  //   const clickedRect = range.getClientRects()[0];

  //   selectedNode && selectedAlert && target
  //     ? setPopoverData({
  //         alert: selectedAlert,
  //         position: clickedRect,
  //         node: selectedNode.node,
  //         originalNode:
  //           isTextArea(target) || isInputText(target) ? target : null,
  //       })
  //     : setPopoverData(null);

  //   setTotalAlerts(
  //     nodesWithAlertsRef.current.reduce(
  //       (total, node) => total + node.alerts.length,
  //       0
  //     )
  //   );
  // }, [selectedAlert]);

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
    setTextToCheck(new String(text) as string);
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

  // const togglePopover = (): void => {
  //   setIsPopoverOpen(!isPopoverOpen);
  //   if (isPopoverOpen) {
  //     if (popoverData) analytics.popoverLogs(popoverData.alert, 'popover_open');
  //     setSelectedAlert(null);
  //   }
  // };

  // const closePopover = (): void => {
  //   if (!popoverData) return;
  //   analytics.popoverLogs(popoverData.alert, 'popover_open');
  //   setSelectedNodeIndex(-1);
  //   setSelectedAlertIndex(-1);
  // };

  const hidePopover = () => {
    if (popoverData) {
      setPopoverData(null);
      analytics.popoverLogs(popoverData.alert, 'popover_open'); //TODO this only logs when the popover closes! also, the popover_close is logged in HighlightPopover.tsx handleClickOutside
      setSelectedNodeWithAlertsIndex(-1);
      setSelectedAlertIndex(-1);
    }
  };

  const resendText = () => {
    const text: string = getInputText(element);
    setTextToCheck(text);
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
        let caret: { position: number | null; element: Node | null } =
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
              (alert: IAlert) =>
                alert.startOffset < (caret.position as number) &&
                alert.endOffset > (caret.position as number)
            );

            if (selectedAlertIndex > -1) {
              setSelectedAlertIndex(selectedAlertIndex);
              // const selectedAlert =
              //   oneNodeWithAlerts.alerts[selectedAlertIndex];

              // const range = document.createRange();
              // const nodeText = oneNodeWithAlerts.node;
              // range.setStart(nodeText, selectedAlert.startOffset);
              // range.setEnd(nodeText, selectedAlert.endOffset);
              // const clickedRect = range.getClientRects()[0];

              // setPopoverData({
              //   alert: selectedAlert,
              //   position: clickedRect,
              //   node: nodeText,
              //   originalNode:
              //     isTextArea(target) || isInputText(target) ? target : null,
              // });

              // const alertIndex = nodesWithAlertsRef.current
              //   .slice(0, selectedNodeWithAlertsIndex + 1)
              //   .reduce(
              //     (acc, node, index, array) =>
              //       index === array.length - 1
              //         ? acc + selectedAlertIndex + 1
              //         : acc + node.alerts.length,
              //     0
              //   );

              // setVirtualAlertIndex(alertIndex);

              // setSelectedAlert(selectedAlert);
              // togglePopover();
            }
          }
        }
      }, 400);
    } else {
      clearTimeout(singleClickTimeOut);
    }
  };

  const updatePopover = (direction: string): void => {
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

      const target = nodeText.parentNode as Element;

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
        originalNode: isTextArea(target) || isInputText(target) ? target : null,
      });
    }
  }, [selectedNodeWithAlertsIndex, selectedAlertIndex]);

  // useEffect(() => {}, [popoverData]);

  // const updatePopover = (direction: string): void => {
  //   if (selectedNodeIndex < 0 || selectedAlertIndex < 0) return;

  //   if (direction == 'previous') {
  //     const isFirstNodeSelected = selectedNodeIndex == 0;
  //     const isFirstAlertSelected = selectedAlertIndex == 0;
  //     if (isFirstNodeSelected && isFirstAlertSelected) return;
  //     else if (isFirstAlertSelected) {
  //       setSelectedNodeIndex(selectedNodeIndex - 1);
  //       setSelectedAlertIndex(
  //         nodesWithAlertsRef.current[selectedNodeIndex - 1].alerts.length - 1
  //       );
  //     } else {
  //       setSelectedAlertIndex(selectedAlertIndex - 1);
  //     }
  //   }

  //   if (direction == 'next') {
  //     const isLastNodeSelected =
  //       selectedNodeIndex === nodesWithAlertsRef.current.length - 1;
  //     const isLastAlertSelected =
  //       selectedAlertIndex === selectedNode.alerts.length - 1;
  //     if (isLastNodeSelected && isLastAlertSelected) return;
  //     else if (isLastAlertSelected) {
  //       setSelectedNodeIndex(selectedNodeIndex + 1);
  //       setSelectedAlertIndex(0);
  //     } else {
  //       setSelectedAlertIndex(selectedAlertIndex + 1);
  //     }
  //   }
  // };

  // const handleElementClickEvent = (event: MouseEvent) => {
  //   // If user clicks on an element only once...
  //   if (event.detail === 1) {
  //     singleClickTimeOut = setTimeout(function () {
  //       if (caretPosition < 0) return;
  //       const nextNodeIndex = nodesWithAlertsRef.current.findIndex(
  //         (nodeWithAlerts: INodeWithAlerts) =>
  //           //TODO potentially this acces to parentNode could fail
  //           isTextArea(target) || isInputText(target)
  //             ? nodeWithAlerts.node.parentNode === cloneRef.current
  //             : nodeWithAlerts.node.parentNode === target
  //       );
  //       const nextNode = nodesWithAlertsRef.current[nextNodeIndex];
  //       if (!nextNode) return;
  //       const nextAlertIndex = nextNode.alerts.findIndex(
  //         (alert: IAlert) =>
  //           alert.startOffset < caretPosition && alert.endOffset > caretPosition
  //       );
  //       if (nextAlertIndex === -1) return;
  //       setSelectedNodeIndex(nextNodeIndex);
  //       setSelectedAlertIndex(nextAlertIndex);
  //     }, 400);
  //   } else {
  //     clearTimeout(singleClickTimeOut);
  //   }

  //   const target = event.target as CustomInputElement;
  //   const caretPosition: number = getInputClickedPosition(target);
  //   setTarget(target);
  // };

  // const getInputClickedPosition = (element: CustomInputElement): number => {
  //   if (isTextArea(element) || isInputText(element)) {
  //     return element.selectionStart as number;
  //   } else {
  //     const selection: Selection | null = document.getSelection();
  //     return selection ? selection.anchorOffset : -1;
  //   }
  // };

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
              alertsWithoutIgnoredTermsGravityReduced
            );

      //Set the total alerts
      const totalAlerts: number = nodesWithAlertsTemp.reduce(
        (total, node) => total + node.alerts.length,
        0
      );
      setTotalAlerts(totalAlerts);

      setNodesWithAlerts(nodesWithAlertsTemp);
    }
  }, [alerts, ignoredTerms, clone]); //TODO is clone needed here?

  const getNodesWithRecalculatedPositionAlerts = (
    alerts: IAlert[]
  ): INodeWithAlerts[] => {
    const nodesWithAlertsTemp: INodeWithAlerts[] = [];

    const nextText: string = getInputText(element);

    let textStartingAbsPosition: number = 0;
    let textEndAbsPosition: number = 0;

    const elementEvaluation: XPathResult = document.evaluate(
      './/text()',
      element,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

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
          // hide={closePopover}
          resendText={resendText}
          addIgnoredTerm={addIgnoredTerm}
          updatePopover={updatePopover}
          // selectedAlertIndex={0}
          // totalAlerts={99}
          // selectedAlertIndex={virtualAlertIndex}
          // totalAlerts={totalAlerts}
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
