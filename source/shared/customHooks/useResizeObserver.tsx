import { useState, useEffect } from 'react';

export const useResizeObserver = (
  element: HTMLElement,
  scrolledElement: HTMLElement
): DOMRect => {
  const [rect, setRect] = useState<DOMRect>(new DOMRect());

  const resizeListener = () => {
    // const customDoc = document.documentElement || document.body;
    // console.log('Witty resiiiize');
    const { width, height, top, left } = element.getBoundingClientRect();
    setRect(
      new DOMRect(
        left + scrolledElement.scrollLeft,
        top + scrolledElement.scrollTop,
        width,
        height
      )
    );
  };

  const [resizeObserver] = useState(new ResizeObserver(resizeListener));

  useEffect(() => {
    resizeObserver.disconnect();
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  return rect;
};
