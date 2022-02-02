import React, { useState, useEffect, useRef } from 'react';
import TextAreaClone from './TextAreaClone';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import { CustomInputElement, IAlert, Highlight, INodeWithAlerts, ScrollPos } from '../shared/types';
import { fixLineBreaks, isTextArea, isInputText, elementExistsinDOM } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { getColor } from '../shared/constants';
import { throttle } from 'lodash';
import { drawLine, handleCanvasClick, drawHighlight } from './highlightsUtils';
import HighlightPopover, {
  PopoverData,
} from './HighlightPopover/HighlightPopover';
import InputTextClone from './InputTextClone';

const Input: React.FC<{
  element: CustomInputElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
}> = ({ element, bodyScroll, parentScroll }) => {
  const [loading, checkEndpointResponse, checkEndpointError, setTextToCheck] = useCheckEndpoint();
  const analytics = useAnalytics();
  const elementRect = useResizeObserver(element);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [elementScroll, setElementScroll] = useState<ScrollPos>({
    top: 0,
    left: 0,
  } as ScrollPos);
  const [popoverData, setPopoverData] = useState<PopoverData>(
    {} as PopoverData
  );
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);

  const [nodesWithAlerts, setNodesWithAlerts] = useStateRef([] as INodeWithAlerts[]);
  const [clone, setClone] = useStateRef({} as HTMLDivElement);

  const log = useLog('Input');

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'
    handleKeyupEvent();
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleKeyupEvent);
    element.addEventListener('scroll', handleElementScrollEvent, true);

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

  const toggleModal = (): void => {
    setIsOpen(!isOpen);
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


  useEffect(() => {
    let newHighlights: Highlight[] = [];
    if (nodesWithAlerts.length === 0) setHighlights([]);
    nodesWithAlerts.forEach(({ node, alerts }) => {
      //quick fix to avoid error: check if node exists in the DOM
      //but also filter alerts that have a bigger endOffset than the length of the text
      if (typeof node !== 'undefined' && elementExistsinDOM(node)) {
        alerts
          .filter(
            (alert: IAlert) =>
              node && node.textContent &&
              alert.endOffset <= node.textContent.length
          )
          .forEach((alert: IAlert) => {
            const range = document.createRange();
            if (node) range.setStart(node, alert.startOffset);
            if (node) range.setEnd(node, alert.endOffset);
            const rects: DOMRect[] = Array.from(range.getClientRects())
              .map((rect: DOMRect) => {
                return {
                  ...rect,
                  width: rect.width,
                  height: rect.height,
                  left: rect.left,
                  x: rect.left,
                  top: rect.top + bodyScroll.top,
                  y: rect.top,
                };
              });

            const newHighlight: Highlight = {
              id: alert.id,
              rects,
              data: alert.data,
              startOffset: alert.startOffset,
              endOffset: alert.endOffset,
              node: node,
            };
            newHighlights.push(newHighlight);
          });
        setHighlights(newHighlights);
      }
    });
  }, [nodesWithAlerts, parentScroll, elementScroll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    //makes the canvas ratio correct, needed to make text clear
    const ratio = window.devicePixelRatio;
    canvas.width = elementRect.width * ratio;
    canvas.height = elementRect.height * ratio;
    canvas.style.width = elementRect.width + "px";
    canvas.style.height = elementRect.height + "px";
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!context) return;

    context.scale(ratio, ratio)
    context.clearRect(0, 0, canvas.width, canvas.height);
    const canvasClickListeners: Array<(e: MouseEvent) => void> = highlights.map((highlight) => {
      const [rect] = highlight.rects;
      const hoverColor = `${getColor(highlight.data.category).hover}`;
      const highlightColor = `${getColor(highlight.data.category).highlight}`;
      const roundedHighlight = new Path2D();
      const params = {
        context,
        element,
        roundedHighlight,
        highlight,
        hoverColor,
        highlightColor,
        rect,
        elementRect,
        canvas,
      };

      drawHighlight(params, 'transparent'); //the clickable container
      drawLine(params, hoverColor);

      return function (event: MouseEvent) {
        const newPopoverData = handleCanvasClick(event, params);
        if (newPopoverData && newPopoverData.alert && newPopoverData.position && newPopoverData.node) {
          //timeout allows user to double click 
          setTimeout(() => {
            setPopoverData(newPopoverData);
            toggleModal();
          }, 500);
        }
      }
    });
    canvasClickListeners.forEach((listener) => canvas.addEventListener('click', listener));

    return () => {
      canvasClickListeners.forEach((listener) => canvas.removeEventListener('click', listener));
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [highlights]);

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
      {loading && <HighlightsLoader elementReference={element} />}
      {popoverData.alert && isOpen && (
        <HighlightPopover
          element={element}
          data={popoverData}
          hide={toggleModal}
          resendText={resendText}
          addIgnoredTerm={addIgnoredTerm}
        />
      )}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          overflow: 'auto',
          left: `${elementRect.left}px`,
          top: `${elementRect.top}px`,
          zIndex: 99999999,
        } as React.CSSProperties}
        width={elementRect.width}
        height={elementRect.height}
      >
      </canvas>
    </div>
  );
};

export default Input;
