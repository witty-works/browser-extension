import { useState, useEffect } from 'react';

export function useResizeObserver(element: Element): DOMRect;
export function useResizeObserver(element: Element | null): DOMRect | null;
export function useResizeObserver(element: Element | null): DOMRect | null {
  if (!element) return null;
  const [rect, setRect] = useState<DOMRect>(new DOMRect());
  const doc = document.documentElement || document.body;

  const resizeListener = () => {
    const { width, height, top, left } = element.getBoundingClientRect();

    setRect(
      new DOMRect(left + doc.scrollLeft, top + doc.scrollTop, width, height)
    );
  };

  const [resizeObserver] = useState(new ResizeObserver(resizeListener));

  useEffect(() => {
    resizeObserver.disconnect();
    resizeObserver.observe(element);
    resizeObserver.observe(doc);

    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  return rect;
}
