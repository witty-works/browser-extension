import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import {
  CustomInputElement,
  Iinput,
  IAlert,
  IAlertContentData,
} from '../shared/types';
import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import TextAreaClone from './TextAreaClone';
import DivClone from './DivClone';
import useStateRef from '../shared/customHooks/useStateRef';
import { DEV_ENV } from '../shared/constants';
import { useCheckEndpoint } from '../shared/ApiServices/useEndpoint';
import Highlights from './Highlights';
import HighlightsLoader from './HighlightsLoader';
import { convertHTMLToText, convertTextToHTML } from '../shared/utils';
import Modal, { ModalData } from '../shared/components/Modal/Modal';

type HandleClick = () => void;

const ContentScriptApp: React.FC = () => {
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');
  const [inputs, setInputs, inputsRef] = useStateRef([] as Iinput[]);
  const [focusedInput, setFocusedInput] = useState<CustomInputElement>(
    {} as CustomInputElement
  );
  const [loading, checkEndpointResponse, checkEndpointError, sendText] =
    useCheckEndpoint();
  const [modalData, setModalData] = useState<ModalData>({} as ModalData);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    //Define the Endpoint
    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setUrlEndpointKey(result[StorageKeys.API_ENDPOINT_KEY]);
        else setUrlEndpointKey(DefaultBaseUrlKey);
      })
      .catch(onError);

    // const section = document.querySelector('section');
    // const newEditableDiv: HTMLDivElement = document.createElement(
    //   'DIV'
    // ) as HTMLDivElement;
    // newEditableDiv.id = 'div-editable';
    // newEditableDiv.contentEditable = 'true';
    // newEditableDiv.style.backgroundColor = 'white';
    // newEditableDiv.style.width = '600px';
    // newEditableDiv.style.height = '300px';
    // newEditableDiv.style.padding = '10px';
    // newEditableDiv.style.overflow = 'auto';
    // if (section) section.appendChild(newEditableDiv);

    //TEMPORAL, create an extra textarea
    // const newTextarea: HTMLTextAreaElement = document.createElement(
    //   'TEXTAREA'
    // ) as HTMLTextAreaElement;
    // newTextarea.id = 'editor-copy';
    // newTextarea.cols = 25;
    // newTextarea.rows = 25;
    // if (section) section.appendChild(newTextarea);

    //Capture all the scrolling events, including window scrolling
    browser.storage.onChanged.addListener(storageChange);
    document.addEventListener('focusin', handleFocusinElement, true);
    document.addEventListener('input', handleInputElement);
    window.addEventListener('scroll', handleScrollElement, true);
    document.addEventListener('click', handleClickElement);

    return () => {
      //Don't forget to remove the listeners at the end
      browser.storage.onChanged.removeListener(storageChange);
      document.removeEventListener('focusin', handleFocusinElement);
      document.removeEventListener('input', handleInputElement);
      window.removeEventListener('scroll', handleScrollElement);
      document.removeEventListener('click', handleClickElement);
    };
  }, []);

  const storageChange = (changes: any) => {
    let changedItems = Object.keys(changes);

    for (let item of changedItems) {
      switch (item) {
        case StorageKeys.API_ENDPOINT_KEY:
          setUrlEndpointKey(changes[item].newValue);
          break;
      }
    }
  };

  const isInputElement = (element: CustomInputElement) => {
    return (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLDivElement
    );
  };

  const getInputElementIndexPos = (element: CustomInputElement): number => {
    return inputsRef.current.findIndex(
      (input: Iinput) =>
        input.inputElement &&
        isInputElement(input.inputElement) &&
        input.inputElement === element
    );
  };

  useEffect(() => {
    if (urlEndpointKey.localeCompare('') !== 0) {
      setBaseURL(urlEndpointKey);
    }
  }, [urlEndpointKey]);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('onError = ', error);
  };

  const handleFocusinElement = (event: Event) => {
    const target = event.target as CustomInputElement;

    //Ignore the modal, does not need to be tracked
    if (target.id !== 'modal') {
      const index = getInputElementIndexPos(target);

      if (index === -1) {
        const newInput: Iinput = {
          cloneElement: {} as HTMLDivElement,
          inputElement: target,
          alerts: [],
        } as Iinput;

        setInputs([...(inputsRef.current as Iinput[]), newInput]); //TODO needed?
      }
    }
  };

  const updateInputElement = (element: CustomInputElement): void => {
    const index: number = getInputElementIndexPos(element);

    //TODO checking type of input it's too much repeated...
    if (index !== -1) {
      inputsRef.current[index].inputElement = element;

      setInputs([...(inputsRef.current as Iinput[])]);
    }
  };

  const handleInputElement = (event: Event) => {
    console.log('handleInputElement event = ', event);

    const target = event.target as CustomInputElement;
    setFocusedInput(target);

    updateInputElement(target);

    const text =
      target instanceof HTMLTextAreaElement
        ? target.value
        : convertHTMLToText(target.innerHTML);
    sendText(text);
  };

  const handleScrollElement = (event: Event) => {
    const target = event.target as CustomInputElement;

    if (target.nodeName.localeCompare('#document') === 0) {
      //User is scrolling the whole page, update all the input elements
      const elements = Array.from(
        document.querySelectorAll(`
          textarea,
          div[contenteditable=true]
        `)
      ) as HTMLElement[];

      elements.forEach((element: HTMLElement) =>
        updateInputElement(element as CustomInputElement)
      );
    } else {
      //User is scrolling a specific component, we just update this one
      updateInputElement(target as CustomInputElement);
    }
  };

  const handleClickElement = (event: Event) => {
    const target: CustomInputElement = (
      event.target instanceof HTMLTextAreaElement
        ? event.target
        : (event.composedPath && event.composedPath()).find(
            (element) => (element as HTMLDivElement).contentEditable === 'true'
          )
    ) as CustomInputElement;

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
  };

  const getInputClickedPosition = (element: CustomInputElement): number => {
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
  };

  const toggleModal: HandleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleAlternativeClick = (index: number) => {
    const inputIndex = getInputElementIndexPos(focusedInput);
    const myInput: Iinput = inputsRef.current[inputIndex];

    //Replace text with the new alternative or simply remove it
    //This only replaces the specific occurrence. If there are other identical terms in the text
    //they will keep highlighted
    const myText: string =
      myInput.inputElement instanceof HTMLTextAreaElement
        ? myInput.inputElement.value
        : myInput.cloneElement.innerHTML;

    const splitText: string[] = myText.split('');

    splitText.splice(
      modalData.alert.startOffset,
      modalData.alert.endOffset - modalData.alert.startOffset,
      index === -1 ? '' : modalData.alert.data.alternatives[index]
    );

    const textToInsert = splitText.join('');

    const htmlString: string = convertTextToHTML(textToInsert);

    myInput.inputElement instanceof HTMLTextAreaElement
      ? (myInput.inputElement.value = textToInsert)
      : (myInput.inputElement.innerHTML = htmlString);

    inputsRef.current[inputIndex] = {
      ...inputsRef.current[inputIndex],
      alerts: [],
      inputElement: focusedInput,
    };

    //Close Modal
    toggleModal();

    //Send again all the text to recalculate highlight positions
    sendText(textToInsert);
  };

  const updateTextAreaCloneData = (
    textAreaElement: HTMLTextAreaElement,
    divElement: HTMLDivElement
  ) => {
    const index: number = getInputElementIndexPos(textAreaElement);
    (inputsRef.current[index] as Iinput).cloneElement = divElement;
  };

  const updateDivCloneData = (
    originalElement: HTMLDivElement,
    divElement: HTMLDivElement
  ) => {
    const index: number = getInputElementIndexPos(originalElement);
    (inputsRef.current[index] as Iinput).cloneElement = divElement;
  };

  useEffect(() => {
    console.log('INPUTS = ', inputs);
  }, [inputs]);

  useEffect(() => {
    const index: number = getInputElementIndexPos(focusedInput);
    if (index !== -1)
      (inputsRef.current[index] as Iinput).alerts =
        checkEndpointResponse.results.map((result: any) => ({
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
        }));
  }, [checkEndpointResponse]);

  useEffect(() => {
    if (checkEndpointError.detail && checkEndpointError.detail.length > 0) {
      // Error!
      if (DEV_ENV) console.log('API Error = ', checkEndpointError);
    }
  }, [checkEndpointError]);

  return (
    <>
      {inputs.map((input: Iinput, index: number) =>
        input.inputElement?.tagName === 'TEXTAREA' ? (
          <TextAreaClone
            key={index}
            element={input.inputElement as HTMLTextAreaElement}
            updateClone={updateTextAreaCloneData}
          />
        ) : (
          <DivClone
            key={index}
            element={input.inputElement as HTMLDivElement}
            updateClone={updateDivCloneData}
          />
        )
      )}
      {inputs.map((input: Iinput, index: number) => {
        return (
          <Highlights
            key={index}
            cloneElement={input.cloneElement}
            inputElement={input.inputElement}
            alerts={input.alerts}
          />
        );
      })}
      {loading ? <HighlightsLoader elementReference={focusedInput} /> : null}
      {modalData.alert ? (
        <Modal
          isOpen={isOpen}
          data={modalData}
          hide={toggleModal}
          switchAlternative={(index) => handleAlternativeClick(index)}
        />
      ) : null}
    </>
  );
};

export default ContentScriptApp;
