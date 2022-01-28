import React, { useState, useEffect, useRef } from 'react';

import TextAreaClone from './TextAreaClone';
// import InputTextClone from './InputTextClone';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import { CustomInputElement, IAlert, Highlight, INodeWithAlerts, ModalData, ScrollPos } from '../shared/types';
import { fixLineBreaks, isTextArea, isInputText, elementExistsinDOM } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';
import { useStateRef } from '../shared/customHooks/useStateRef';
import Modal from '../shared/components/Modal/Modal';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { getColor } from '../shared/constants';
import { throttle } from 'lodash';

function drawHighlight(context: CanvasRenderingContext2D, roundedHighlight: any, color: string, x: number, y: number, width: number, height: number) {
  context.clearRect(x - 1, y - 1, width + 2, height + 2); // clear the previous rectangle
  context.fillStyle = color;
  context.fill(roundedHighlight)
}

function redrawText(context: CanvasRenderingContext2D, element: HTMLElement, highlight: Highlight, x: number, y: number, height: number) {
  const style = window.getComputedStyle(element);
  context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
  context.fillStyle = style.color;
  context.textBaseline = "bottom";
  context.fillText(highlight.data.text, x, y + height - 1);
}

const Input: React.FC<{
  element: CustomInputElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
}> = ({ element, bodyScroll, parentScroll }) => {
  const [loading, checkEndpointResponse, checkEndpointError, setTextToCheck] = useCheckEndpoint();
  const analytics = useAnalytics();
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [nodesWithAlerts, setNodesWithAlerts] = useStateRef<INodeWithAlerts[]>([]); //nodesWithAlertsRef
  const [clone, setClone] = useStateRef({} as HTMLDivElement); //cloneRef
  const elementRect = useResizeObserver(element);
  const [elementScroll, setElementScroll] = useState<ScrollPos>({ top: 0, left: 0 } as ScrollPos);
  const [modalData, setModalData] = useState<ModalData>({} as ModalData);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);
  const log = useLog('Input');

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The turn around (at least for the moment) is to use 'keyup'
    handleKeyupEvent();
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleKeyupEvent);
    element.addEventListener('scroll', handleElementScrollEvent, true);

    //If a parent form exists, we will monitor the submision.
    //This will allow us remove remaining highlights when text disappear
    const parentForm: HTMLFormElement | null = isTextArea(element)
      ? (element as HTMLTextAreaElement).form
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
    if (nextText.length === 0 || !nextText.match(/[a-z0-9]/i)) setNodesWithAlerts([]);
    else {
      setTextToCheck(nextText)
    }
  }, 1000);

  const handleElementScrollEvent = throttle(() => {
    setElementScroll({ top: element.scrollTop, left: element.scrollLeft });
  }, 500);

  const handleSubmitFormEvent = () => {
    //It's assumed that when user sends info through a form, text will disappear.
    //Therefore highlights also need to be removed
    setNodesWithAlerts([]);
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
    console.log('ignored terms', ignoredTerms);
    if (alerts.length === 0) setNodesWithAlerts([]);
    else {
      const filteredAlerts: IAlert[] = alerts.filter((alert: IAlert) => {
        return !ignoredTerms.includes(alert.data.text);
      });
      console.log('clone', clone);
      if (isTextArea(element) || isInputText(element)) {
        setNodesWithAlerts([
          {
            node: clone,
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
    console.log('nodes with alerts updated', nodesWithAlerts);
    let newHighlights: Highlight[] = [];
    if (nodesWithAlerts.length > 0) {
      nodesWithAlerts.forEach(({ node, alerts }) => {
        //quick fix to avoid error: check if node exists in the DOM
        //but also filter alerts that have a bigger endOffset than the length of the text
        if (typeof node !== 'undefined' && elementExistsinDOM(node)) {
          alerts
            .filter(
              (alert: IAlert) =>
                node.firstChild && node.firstChild.textContent &&
                alert.endOffset <= node.firstChild.textContent.length
            )
            .forEach((alert: IAlert) => {
              const range = document.createRange();
              if (node.firstChild) range.setStart(node.firstChild, alert.startOffset);
              if (node.firstChild) range.setEnd(node.firstChild, alert.endOffset);
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
    }
  }, [nodesWithAlerts, parentScroll, elementScroll]);

  useEffect(() => {
    console.error('recieved new highlights', highlights);
    const canvas: HTMLCanvasElement = canvasRef.current;
    if (canvas) {
      //makes the ratio correct, needed to make text clear
      let ratio = window.devicePixelRatio;
      canvas.width = elementRect.width * ratio;
      canvas.height = elementRect.height * ratio;
      canvas.style.width = elementRect.width + "px";
      canvas.style.height = elementRect.height + "px";
      const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
      if (context) {
        context.scale(ratio, ratio)
        context.clearRect(0, 0, canvas.width, canvas.height);
        console.log('CLEAR')

        //draw a rectangle for each highlight
        highlights.forEach((highlight) => {
          highlight.rects.forEach((rect: DOMRect) => {
            let x = rect.left - elementRect.left;
            let y = rect.top - elementRect.top;
            let width = rect.width;
            let height = rect.height;
            let radius = 4;

            //making the highlight shape with rounded corners
            context.beginPath();
            const roundedHighlight = new Path2D();
            roundedHighlight.moveTo(x + radius, y);
            roundedHighlight.arcTo(x + width, y, x + width, y + height, radius);
            roundedHighlight.arcTo(x + width, y + height, x, y + height, radius);
            roundedHighlight.arcTo(x, y + height, x, y, radius);
            roundedHighlight.arcTo(x, y, x + width, y, radius);
            context.closePath();

            drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).highlight}`, x, y, width, height);
            redrawText(context, element, highlight, x, y, height);

            //hover highlight
            canvas.addEventListener('mousemove', function (e) {
              if (context.isPointInPath(roundedHighlight, e.offsetX * ratio, e.offsetY * ratio)) {
                drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).hover}`, x, y, width, height);
                redrawText(context, element, highlight, x, y, height);
              } else {
                drawHighlight(context, roundedHighlight, `${getColor(highlight.data.category).highlight}`, x, y, width, height);
                redrawText(context, element, highlight, x, y, height);
              }
            });

            //click highlight
            canvas.addEventListener('click', function (event) {
              //TODO: also open for double click 
              if (context.isPointInPath(roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
                console.log('click on highlight')
                setModalData({
                  alert: highlight,
                  position: highlight.rects[0],
                  node: highlight.node,
                  originalNode: null
                });
                setIsOpen(!isOpen);
                //remove highlight if no longer necessary
                // redrawText(context, element, highlight, x, y, height);
              }
              else {
                canvas.style.pointerEvents = 'none';
                console.log('click outside highlight')
                element.focus();
                setTimeout(() => {
                  canvas.style.pointerEvents = 'auto';
                }, 1000);
              }
            });
          });
        });
      }
    } else {
      //TODO Provide Canvas Fallback content?
      //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
    }
  }, [highlights]);

  const updateCloneData = (clone: HTMLDivElement) => {
    // element = clone;
    setClone(clone);
    console.log('updateCloneData', clone);
  };

  const toggleModal = (): void => {
    setIsOpen(!isOpen);
  };

  const resendText = (text: string): void => {
    setTextToCheck(text);
  };

  const addIgnoredTerm = (term: string): void => {
    setIgnoredTerms([...ignoredTerms, term]);
  };

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
      {/* no longer in use? */}
      {/* {isInputText(element) && (
        <InputTextClone
          element={element}
          elementRect={elementRect}
          updateClone={updateCloneData}
        />
      )} */}
      {modalData.alert && (
        <Modal
          isOpen={isOpen}
          data={modalData}
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
        } as React.CSSProperties}
        width={elementRect.width}
        height={elementRect.height}
      >
      </canvas>
    </div>
  );
};

export default Input;
