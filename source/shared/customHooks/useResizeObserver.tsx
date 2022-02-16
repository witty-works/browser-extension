import { useState, useEffect } from 'react';

export const useResizeObserver = (element: HTMLElement): DOMRect => {
  const [rect, setRect] = useState<DOMRect>(new DOMRect());
  const doc = document.documentElement || document.body;

  const resizeListener = () => {
    const { width, height, top, left } = element.getBoundingClientRect();

    setRect(
      new DOMRect(left + doc.scrollLeft, top + doc.scrollTop, width, height)
    );
  };

  useEffect(() => {
    const resizeObserver = new ResizeObserver(resizeListener);
    resizeObserver.observe(window.document.body);
    return () => {
      resizeObserver.unobserve(window.document.body);
    };
  }, [element]);

  return rect;
};
