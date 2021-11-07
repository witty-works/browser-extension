import React, { useState, useEffect } from 'react';

import TextAreaClone from './TextAreaClone';
import Highlights, { ScrollPos } from './Highlights';
import HighlightsLoader from './HighlightsLoader';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import { DEV_ENV } from '../shared/constants';
import { CustomInputElement, IAlert, IAlertContentData } from '../shared/types';
import { fixLineBreaks } from '../shared/utils';
import { useResizeObserver } from '../shared/customHooks/useResizeObserver';

const Input: React.FC<{ element: CustomInputElement }> = ({ element }) => {
  const [loading, checkEndpointResponse, checkEndpointError, sendText] =
    useCheckEndpoint();
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [clone, setClone] = useState<HTMLDivElement>();
  const elementRect = useResizeObserver(element);
  const [elementScroll, setElementScroll] = useState<ScrollPos>(
    {} as ScrollPos
  );

  useEffect(() => {
    //Listener should be on input, but on Twitter it simply does not fire when deleting
    //The turn around (at least for the moment) is to use 'keyup'
    element.addEventListener('keyup', handleKeyupEvent);
    element.addEventListener('scroll', handleScrollEvent, true);
    // element.addEventListener('click', handleClickElement);
    return () => {
      //Don't forget to remove the listeners at the end
      element.removeEventListener('keyup', handleKeyupEvent);
      element.removeEventListener('scroll', handleScrollEvent);
      // element.removeEventListener('click', handleClickElement);
    };
  }, []);

  const handleKeyupEvent = (event: Event) => {
    const target = event.target as CustomInputElement;
    const text: string =
      target instanceof HTMLTextAreaElement
        ? target.value
        : fixLineBreaks(target.innerText);

    sendText(text);
  };

  const handleScrollEvent = (event: Event) => {
    //TODO add throttle
    const target = event.target as CustomInputElement;
    console.log('handleScrollEvent target.scrollTop = ', target.scrollTop);
    setElementScroll({ top: target.scrollTop, left: target.scrollLeft });
  };

  /*const handleClickElement = (event: Event) => {
    const target: CustomInputElement = (
      event.target instanceof HTMLTextAreaElement
        ? event.target
        : (event.composedPath && event.composedPath()).find(
            (element) => (element as HTMLDivElement).contentEditable === 'true'
          )
    ) as CustomInputElement;

    console.log('Input handleClickElement target = ', target);

    const caretPosition: number = getInputClickedPosition(target);

    console.log('Input handleClickElement caretPosition = ', caretPosition);

    /*
    const index = getInputElementIndexPos(target);

    const currentInput = inputsRef.current[index];

    if (index !== -1 && currentInput.alerts.length > 0) {
      setFocusedInput(target); //TODO needed?

      const caretPosition: number = getInputClickedPosition(
        currentInput.inputElement
      );

      if (caretPosition > -1) {
        const clickedHighlight: IAlert = currentInput.alerts.find(
          (alert: IAlert) => {
            return (
              alert.startOffset < caretPosition &&
              alert.endOffset > caretPosition
            );
          }
        );
        const range = document.createRange();
        const nodeText = currentInput.cloneElement.childNodes[0];
        if (clickedHighlight) {
          range.setStart(nodeText, clickedHighlight.startOffset);
          range.setEnd(nodeText, clickedHighlight.endOffset);
          const clickedRect = range.getClientRects()[0];
          setModalData({
            alert: clickedHighlight,
            position: clickedRect,
          });
          toggleModal();
        }
      }
    }
    * /
  };*/

  /*const getInputClickedPosition = (element: CustomInputElement): number => {
    if (element instanceof HTMLTextAreaElement) {
      return element.selectionStart;
    } else {
      const selection: Selection | null = document.getSelection();

      if (selection !== null) {
        //Modify is a non-standard feature, although currently is supported by all browsers except IE
        //https://developer.mozilla.org/en-US/docs/Web/API/Selection/modify

        //TODO In order to remove error from typescript we can augment the interface
        //https://github.com/Microsoft/TypeScript/issues/12296
        //Temporaly ignore this error
        // @ts-ignore
        selection.modify('extend', 'backward', 'documentboundary');
        const position = selection.toString().length as number;
        if (selection.anchorNode != undefined) selection.collapseToEnd();
        return position;
      } else return -1;
    }
  };*/

  useEffect(() => {
    if (checkEndpointResponse) {
      const alerts: IAlert[] = checkEndpointResponse.results.map(
        (result: any) => ({
          //TODO specify this 'any' type on the line before
          id: `${result.category}-${result.text}-${result.start}-${result.end}`,
          startOffset: result.start,
          endOffset: result.end,
          data: {
            category: result.category,
            text: result.text,
            label: result.label,
            reason: result.reason,
            solution: result.solution,
            alternatives: result.alternatives,
          } as IAlertContentData,
        })
      );
      setAlerts(alerts);
    }
  }, [checkEndpointResponse]);

  useEffect(() => {
    if (checkEndpointError.detail && checkEndpointError.detail.length > 0) {
      // Error!
      if (DEV_ENV) console.log('API Error = ', checkEndpointError);
      if (checkEndpointError.detail === 'Language could not be determined')
        setAlerts([]);
    }
  }, [checkEndpointError]);

  const updateTextAreaCloneData = (clone: HTMLDivElement) => {
    setClone(clone);
  };

  return (
    <div className='canvas-container'>
      {element instanceof HTMLTextAreaElement ? (
        <TextAreaClone
          element={element}
          elementRect={elementRect}
          updateClone={updateTextAreaCloneData}
        />
      ) : null}
      {loading ? <HighlightsLoader elementReference={element} /> : null}
      {alerts.length > 0 ? (
        <Highlights
          elementScroll={elementScroll}
          elementRect={elementRect}
          elementChildNodes={
            (
              (element instanceof HTMLTextAreaElement
                ? clone
                : element) as HTMLDivElement
            ).childNodes
          }
          alerts={alerts}
        />
      ) : null}
    </div>
  );
};

export default Input;
