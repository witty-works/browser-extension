import { useState, useEffect } from 'react';

import { Position } from '../types';
import { isObjectEmpty } from '../utils';

export const usePositionCorrection = (
  element: HTMLElement,
  parentElement: HTMLElement | null
): Position => {
  const [position, setPosition] = useState<Position>({} as Position);

  useEffect(() => {
    const elementRect: DOMRect = element.getBoundingClientRect();

    const newPosition =
      parentElement && !isObjectEmpty(parentElement)
        ? {
            top: navigator.userAgent.match(/firefox|fxios/i)
              ? 0
              : elementRect.top - parentElement.getBoundingClientRect().top,
            left: elementRect.left - parentElement.getBoundingClientRect().left,
          }
        : {
            top: elementRect.top,
            left: elementRect.left,
          };

    setPosition(newPosition);
  }, [element, parentElement]);

  return position;
};
