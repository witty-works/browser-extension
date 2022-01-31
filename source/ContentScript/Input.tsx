import React, { useState, useEffect, useRef, useCallback } from 'react';

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
import { drawHighlight, handleCanvasClick, redrawText } from './highlightsUtils';

const Input: React.FC<{
  element: CustomInputElement;
  bodyScroll: ScrollPos;
  parentScroll: ScrollPos;
}> = ({ element, bodyScroll, parentScroll }) => {
  const [loading, checkEndpointResponse, checkEndpointError, setTextToCheck] = useCheckEndpoint();
  const analytics = useAnalytics();
  const elementRect = useResizeObserver(element);
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);

  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [elementScroll, setElementScroll] = useState<ScrollPos>({ top: 0, left: 0 } as ScrollPos);
  const [modalData, setModalData] = useState<ModalData>({} as ModalData);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [ignoredTerms, setIgnoredTerms] = useState<string[]>([]);
  const [target, setTarget] = useState<CustomInputElement>({} as CustomInputElement);

  const [nodesWithAlerts, setNodesWithAlerts, nodesWithAlertsRef] = useStateRef<INodeWithAlerts[]>([]);
  const [clone, setClone, cloneRef] = useStateRef({} as HTMLDivElement);

  const log = useLog('Input');

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The work around (at least for the moment) is to use 'keyup'
    handleKeyupEvent();
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('focusin', handleKeyupEvent);
    element.addEventListener('scroll', handleElementScrollEvent, true);
    element.addEventListener('click', handleClickElement as EventListener);

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
      element.removeEventListener('click', handleClickElement as EventListener);

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

  const handleClickElement = (event: MouseEvent) => {
    setTarget(event.target as CustomInputElement);
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
        if (!clone.firstChild) {
          console.log('no clone');
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
    console.log('nodes with alerts updated', nodesWithAlerts);
    let newHighlights: Highlight[] = [];
    if (nodesWithAlerts.length > 0) {
      nodesWithAlerts.forEach(({ node, alerts }) => {

        //quick fix to avoid error: check if node exists in the DOM
        //but also filter alerts that have a bigger endOffset than the length of the text
        if (typeof node !== 'undefined' && elementExistsinDOM(node)) {
          console.log('node', node);
          console.log('alerts', alerts);
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
    }
  }, [nodesWithAlerts, parentScroll, elementScroll]);

  const handleCanvasMouseMove = useCallback((event: MouseEvent, params: any) => {
    const ratio = window.devicePixelRatio;

    if (params.context.isPointInPath(params.roundedHighlight, event.offsetX * ratio, event.offsetY * ratio)) {
      drawHighlight(params, params.hoverColor);
      redrawText(params);
    } else {
      drawHighlight(params, params.highlightColor);
      redrawText(params);
    }
  }, [highlights]);

  useEffect(() => {
    const canvas: HTMLCanvasElement = canvasRef.current;
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
    console.error('recieved new highlights', highlights);

    highlights.forEach((highlight) => {
      highlight.rects.forEach((rect: DOMRect) => {
        const highlightColor = `${getColor(highlight.data.category).highlight}`;
        const hoverColor = `${getColor(highlight.data.category).hover}`;
        const roundedHighlight = new Path2D();

        const params = {
          context,
          element,
          roundedHighlight,
          highlight,
          highlightColor,
          hoverColor,
          rect,
          elementRect,
          target,
          canvas,
          nodesWithAlertsRef,
          cloneRef,
        };

        console.log('params', params);
        if (!params.roundedHighlight == undefined) return

        drawHighlight(params, highlightColor);
        redrawText(params);

        canvas.addEventListener('mousemove', function (event: MouseEvent) {
          handleCanvasMouseMove(event, params);
        });

        canvas.addEventListener('click', function (event: MouseEvent) {
          const newModalData = handleCanvasClick(event, params);
          //allows user to double click 
          if (newModalData) {
            setTimeout(() => {
              setModalData(newModalData);
              toggleModal();
            }, 500);
          }
        });

        //remove event listeners
        return () => {
          canvas.removeEventListener('mousemove', function (event: MouseEvent) {
            handleCanvasMouseMove(event, params);
          });

          // canvas.removeEventListener('click', function (event: MouseEvent) {
          //   const newModalData = handleCanvasClick(event, params);
          //   //allows user to double click 
          //   if (newModalData) {
          //     setTimeout(() => {
          //       setModalData(newModalData);
          //       toggleModal();
          //     }, 500);
          //   }
          // });
        }
      });
    });
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
