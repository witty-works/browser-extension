import React, { useEffect, useState } from 'react';

import CarbonCopyTextarea, {
  CarbonCopyTextareaProps,
} from '../shared/components/CarbonCopyTextarea';
import Highlights from '../shared/components/Highlights';

const ContentScriptApp: React.FC = () => {
  const [elem, setElem] =
    useState<CarbonCopyTextareaProps | undefined>(undefined);

  useEffect(() => {
    document.addEventListener('focusin', focusedElement, true);
    document.addEventListener('input', inputElement);
    return () => {
      document.removeEventListener('focusin', focusedElement);
      document.removeEventListener('input', inputElement);
    };
  }, []);

  useEffect(() => {
    elem?.element.addEventListener('scroll', scrollElement);
    return () => {
      elem?.element.removeEventListener('scroll', scrollElement);
    };
  }, [elem]);

  const scrollElement = (event: Event) => {
    setElem({
      element: event.target as HTMLTextAreaElement | HTMLInputElement,
    });
  };

  const focusedElement = (event: FocusEvent) => {
    setElem({
      element: event.target as HTMLTextAreaElement | HTMLInputElement,
    });
  };

  const inputElement = (event: Event) => {
    setElem({
      element: event.target as HTMLTextAreaElement | HTMLInputElement,
    });
  };

  return (
    <div>
      {elem === undefined ? null : (
        <CarbonCopyTextarea element={elem.element} />
      )}
      <Highlights />
    </div>
  );
};

export default ContentScriptApp;
