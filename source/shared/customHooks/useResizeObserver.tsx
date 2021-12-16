import { useState, useEffect } from 'react';

export const useResizeObserver = (
  element: HTMLElement
): DOMRect => {
  const [rect, setRect] = useState<DOMRect>(new DOMRect());
  const doc = document.documentElement || document.body;

  const resizeListener = () => {
    // console.log('useResizeObserver element', element);

    const { width, height, top, left } = element.getBoundingClientRect();
    // console.log('useResizeObserver top', top);
    // console.log('useResizeObserver documentScroll.top', documentScroll.top);
    

    setRect(
      new DOMRect(
        // left + documentScroll.left,
        // top + documentScroll.top,
        left + doc.scrollLeft,
        top + doc.scrollTop,
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
