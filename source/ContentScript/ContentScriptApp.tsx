import React, { useEffect, useCallback, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { StorageKeys, DefaultBaseUrlKey } from '../shared/constants';
import { setBaseURL } from '../shared/ApiServices/requests';
import TextAreaClone from '../shared/components/TextAreaClone';
import Highlights from '../shared/components/Highlights';
import { CustomInputElement, IAlert } from '../shared/types';
import useStateRef from '../shared/customHooks/useStateRef';
import { IElementWithAlerts } from '../shared/types';
import { MessageService } from '../shared/MessageService';
import Modal, { ModalData } from '../shared/components/Modal/Modal';

type HandleClick = () => void;

const ContentScriptApp: React.FC = () => {
  const [urlEndpointKey, setUrlEndpointKey] = useState<string>('');
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputs, setInputs, inputsRef] = useStateRef([]);
  const [focusedInput, setFocusedInput] = useState<CustomInputElement>({});
  const [elementWithAlerts, setElementWithAlerts, elementWithAlertsRef] =
    useStateRef({
      element: null,
      originalElement: null,
      alerts: [],
    });

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

    // Subscribe to the message service
    const subscription = MessageService.onMessage().subscribe(
      (message: IElementWithAlerts) => {
        if (message) {
          setElementWithAlerts(message);
        } else {
          // clear messages when empty message received
          setElementWithAlerts({
            element: null,
            originalElement: null,
            alerts: [],
          });
        }
      }
    );

    //Capture all the scrolling events, including window scrolling
    window.addEventListener('scroll', handleScrollElement, true);
    document.addEventListener('input', handleInputElement);
    document.addEventListener('click', handleClickElement);
    browser.storage.onChanged.addListener(storageChange);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      // return unsubscribe method to execute when component unmounts
      subscription.unsubscribe;
      //Don't forget to remove the listeners at the end
      window.removeEventListener('scroll', handleScrollElement);
      document.removeEventListener('input', handleInputElement);
      document.removeEventListener('click', handleClickElement);
      browser.storage.onChanged.removeListener(storageChange);
      window.removeEventListener('resize', handleWindowResize);
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

  useEffect(() => {
    if (urlEndpointKey.localeCompare('') !== 0) {
      setBaseURL(urlEndpointKey);
      const inputs = getAllInputElements(); //TODO Needs forcing a rerender
      setInputs(inputs);
    }
  }, [urlEndpointKey]);

  const onError = (error: string) => {
    console.log('onError = ', error);
  };

  const getAllInputElements = (): CustomInputElement[] => {
    //Detect all Inputs
    return Array.from(
      document.querySelectorAll(`
      input[type=text],
      textarea,
      div[contenteditable=true]
    `)
    ).map((input, index) => {
      input.setAttribute('data-id', `${input.tagName}-${index}`); //Set an ID to each of them, to recognize them later
      return input as CustomInputElement;
    });
  };

  const findInputElement = (
    inputs: CustomInputElement[],
    element: HTMLElement
  ): number => {
    return inputs.findIndex(
      (input: CustomInputElement) =>
        input.getAttribute('data-id') === element.getAttribute('data-id')
    );
  };

  const handleInputElement = useCallback(
    (event: Event) => {
      const target = event.target as HTMLTextAreaElement;
      const index = findInputElement(inputsRef.current, target);
      inputsRef.current[index] = target;
      setInputs([...inputsRef.current]);
    },
    [inputsRef, setInputs]
  );

  const handleScrollElement = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;

      if (target.nodeName.localeCompare('#document') === 0) {
        //User is scrolling the whole page, update all the input elements
        setInputs([...getAllInputElements()]);
      } else {
        //User is scrolling a specific component, we just update this one
        const index = findInputElement(inputsRef.current, target);
        inputsRef.current[index] = target;
        setInputs([...inputsRef.current]);
      }
    },
    [inputsRef, setInputs]
  );

  const handleClickElement = useCallback(
    (event: Event) => {
      if (elementWithAlertsRef.current.alerts.length > 0) {
        const target = event.target as HTMLTextAreaElement;
        setFocusedInput(target);
        const result = getInputSelection(target);
        const clickedHighlight: IAlert =
          elementWithAlertsRef.current.alerts.find((alert: IAlert) => {
            return (
              alert.startOffset < result.start && alert.endOffset > result.end
            );
          });

        const range = document.createRange();
        const nodeText = elementWithAlertsRef.current.element.childNodes[0];

        if (clickedHighlight) {
          range.setStart(nodeText, clickedHighlight.startOffset);
          range.setEnd(nodeText, clickedHighlight.endOffset);

          const clickedRect = range.getClientRects()[0];

          setModalData({
            content: clickedHighlight.data,
            position: clickedRect,
          });

          toggleModal();
        }
      }
    },
    [elementWithAlertsRef]
  );

  const getInputSelection = (element: any) => {
    let start = 0;
    let end = 0;
    // normalizedValue,
    // range,
    // textInputRange,
    // len,
    // endRange;

    if (typeof element.selectionStart == 'number') {
      start = element.selectionStart;
      end = element.selectionEnd;
    } else {
      //TODO If it's not a textarea...
      //https://jsfiddle.net/ourcodeworld/o4k7rfu0/1/
      // range = document.selection.createRange();
      // if (range && range.parentElement() == el) {
      //     len = el.value.length;
      //     normalizedValue = el.value.replace(/\r\n/g, "\n");
      //     // Create a working TextRange that lives only in the input
      //     textInputRange = el.createTextRange();
      //     textInputRange.moveToBookmark(range.getBookmark());
      //     // Check if the start and end of the selection are at the very end
      //     // of the input, since moveStart/moveEnd doesn't return what we want
      //     // in those cases
      //     endRange = el.createTextRange();
      //     endRange.collapse(false);
      //     if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
      //         start = end = len;
      //     } else {
      //         start = -textInputRange.moveStart("character", -len);
      //         start += normalizedValue.slice(0, start).split("\n").length - 1;
      //         if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
      //             end = len;
      //         } else {
      //             end = -textInputRange.moveEnd("character", -len);
      //             end += normalizedValue.slice(0, end).split("\n").length - 1;
      //         }
      //     }
      // }
    }

    return {
      start: start,
      end: end,
    };
  };

  const toggleModal: HandleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleAlternativeClick = (index: number) => {
    const inputIndex = findInputElement(inputsRef.current, focusedInput);

    //Remove all highlights, need to be updated!
    setElementWithAlerts({
      element: null,
      originalElement: null,
      alerts: [],
    });

    //Replace text with the new alternative or simply remove it
    const textToInsert =
      index === -1
        ? focusedInput.value.replaceAll(`${modalData?.content.text} `, '')
        : focusedInput.value.replaceAll(
            modalData?.content.text,
            modalData?.content.alternatives[index]
          );

    focusedInput.value = textToInsert;
    inputsRef.current[inputIndex] = focusedInput;
    setInputs([...inputsRef.current]);

    //Close Modal
    toggleModal();
  };

  const handleWindowResize = () => {
    setInputs([...getAllInputElements()]);
  };

  return (
    <div>
      {/* {elem === undefined ? null : <TextAreaClone element={elem.element} />} */}
      {inputs
        .filter((input: CustomInputElement) => input.tagName === 'TEXTAREA')
        .map((textarea: HTMLTextAreaElement, index: number) => (
          <TextAreaClone key={index} element={textarea} />
        ))}
      <Highlights data={elementWithAlerts} />
      {modalData ? (
        <Modal
          isOpen={isOpen}
          data={modalData}
          hide={toggleModal}
          switchAlternative={(index) => handleAlternativeClick(index)}
        />
      ) : null}
    </div>
  );
};

export default ContentScriptApp;
