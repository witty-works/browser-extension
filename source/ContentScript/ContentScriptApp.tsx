import React, { useEffect, useState } from 'react';

import CarbonCopyTextarea, {
  CarbonCopyTextareaProps,
} from '../shared/components/CarbonCopyTextarea';

// import { InputElement } from '../shared/types';

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

  return elem === undefined ? null : (
    <CarbonCopyTextarea element={elem.element} />
  );
};

export default ContentScriptApp;
