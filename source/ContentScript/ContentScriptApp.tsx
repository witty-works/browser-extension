import React, { useEffect, useCallback } from 'react';

import TextAreaClone from '../shared/components/TextAreaClone';
import Highlights from '../shared/components/Highlights';
import { CustomInputElement } from '../shared/types';
import useStateRef from '../shared/customHooks/useStateRef';

const ContentScriptApp: React.FC = () => {
  const [inputs, setInputs, inputsRef] = useStateRef([]);

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
      return input;
    });
  };

  useEffect(() => {
    // Find all the different inputs contained in the loaded website
    const inputs = getAllInputElements();
    setInputs(inputs);

    //Capture all the scrolling events, including window scrolling
    window.addEventListener('scroll', handleScrollElement, true);

    return () => {
      //Don't forget to remove the listeners at the end
      window.removeEventListener('scroll', handleScrollElement);
    };
  }, []);

  const handleScrollElement = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;

      if (target.nodeName.localeCompare('#document') === 0) {
        //User is scrolling the whole page, update all the input elements
        setInputs([...getAllInputElements()]);
      } else {
        //User is scrolling a specific component, we just update this one
        const index = inputsRef.current.findIndex(
          (input: CustomInputElement) =>
            input.getAttribute('data-id') === target.getAttribute('data-id')
        );
        inputsRef.current[index] = target;
        setInputs([...inputsRef.current]);
      }
    },
    [inputsRef, setInputs]
  );

  return (
    <div>
      {/* {elem === undefined ? null : <TextAreaClone element={elem.element} />} */}
      {inputs
        .filter((input: CustomInputElement) => input.tagName === 'TEXTAREA')
        .map((textarea: HTMLTextAreaElement, index: number) => (
          <TextAreaClone key={index} element={textarea} />
        ))}
      <Highlights />
    </div>
  );
};

export default ContentScriptApp;
