import { useState, useEffect } from 'react';

import { ScrollPos } from '../../ContentScript/Highlights';

export const useResizeObserver = (
  element: HTMLElement,
  documentScroll: ScrollPos
): DOMRect => {
  const [rect, setRect] = useState<DOMRect>(new DOMRect());

  const resizeListener = () => {
    const { width, height, top, left } = element.getBoundingClientRect();

    setRect(
      new DOMRect(
        left + documentScroll.left,
        top + documentScroll.top,
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
