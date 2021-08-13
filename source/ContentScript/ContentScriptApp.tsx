import React, { useEffect, useCallback } from 'react';

import TextAreaClone from '../shared/components/TextAreaClone';
import Highlights from '../shared/components/Highlights';
import { CustomInputElement } from '../shared/types';
import useStateRef from '../shared/customHooks/useStateRef';

const ContentScriptApp: React.FC = () => {
  // const [elem, setElem] = useState<TextAreaCloneProps | undefined>(undefined);
  // const [inputs, setInputs] = useState<CustomInputElement[]>([]);
  const [inputs, setInputs, inputsRef] = useStateRef([]);

  const getAllInputElements = (): CustomInputElement[] => {
    //Detect all Inputs
    return Array.from(
      document.querySelectorAll(`
      input[type=text],
      textarea
    `)
    ).map((input, index) => {
      input.setAttribute('data-id', `${input.tagName}-${index}`); //Set an ID to each of them, to recognize them later
      return input;
    });
  };

  useEffect(() => {
    const inputs = getAllInputElements();

    setInputs(inputs);

    //Capture all the scrolling events, including window scrolling
    window.addEventListener('scroll', handleScrollElement, true);

    return () => {
      //Don't forget to remove the listeners at the end
      window.removeEventListener('scroll', handleScrollElement);
    };
  }, []);

  useEffect(() => {
    console.log('inputs UPDATE = ', inputs);
    // if (inputs.length > 0)
    //   console.log(
    //     'inputs TEXTAREA offsetTop = ',
    //     inputs[1].offsetTop,
    //     inputs[1].scrollTop
    //   );
  }, [inputs]);

  // useEffect(() => {
  //   //Update the textareas
  //   setTextareas(
  //     inputsRef.current
  //       .filter((input) => input.tagName === 'TEXTAREA')
  //       .map((textarea) => {
  //         console.log('inputsRef.current textarea = ', textarea);
  //         return textarea as HTMLTextAreaElement;
  //       })
  //   );
  // }, [inputsRef]);

  const handleScrollElement = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;

      console.log('inputs  1 = ', inputsRef.current);

      console.log('target = ', target.nodeName);
      console.log('compare = ', target.nodeName.localeCompare('#document'));

      if (target.nodeName.localeCompare('#document') === 0) {
        //User is scrolling the whole page
        console.log('scrolling whole page');
        setInputs([...getAllInputElements()]);
      } else {
        //User is scrolling some component
        console.log('scrolling some component');

        const index = inputsRef.current.findIndex(
          (input: CustomInputElement) =>
            input.getAttribute('data-id') === target.getAttribute('data-id')
        );

        console.log('index = ', index);
        console.log('inputs 2 = ', inputsRef.current);

        inputsRef.current[index] = target;
        setInputs([...inputsRef.current]);
      }
    },
    [inputsRef, setInputs]
  );

  // const handleScrollElement = (event: Event) => {
  //   const target = event.target as HTMLElement;

  //   console.log('target = ', target);
  //   console.log('textareas = ', textareas);
  // };

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
