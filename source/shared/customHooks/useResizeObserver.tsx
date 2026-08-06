import {useState, useEffect} from 'react';
import {getActiveDocument} from '../../ContentScript/ContentScriptApp';
import {isGoogleDocs} from '../DOMutils';
import {getScrollableParentClosestToElement} from '../utils';

export const useResizeObserver = (element: HTMLElement): DOMRect => {
  const [rect, setRect] = useState<DOMRect>(new DOMRect());
  const doc = getActiveDocument().documentElement || getActiveDocument().body;
  const scrollContainer = getScrollableParentClosestToElement(element);

  const updateRect = () => {
    const {width, height, top, left} = element.getBoundingClientRect();

    const scrollTop = isGoogleDocs()
      ? getScrollableParentClosestToElement(element).scrollTop
      : doc.scrollTop;

    setRect(new DOMRect(left + doc.scrollLeft, top + scrollTop, width, height));
  };

  const [resizeObserver] = useState(new ResizeObserver(updateRect));

  useEffect(() => {
    resizeObserver.disconnect();
    resizeObserver.observe(element);
    resizeObserver.observe(doc);

    scrollContainer.addEventListener('scroll', updateRect);

    return () => {
      resizeObserver.disconnect();
      scrollContainer.removeEventListener('scroll', updateRect);
    };
  }, [element]);

  return rect;
};
