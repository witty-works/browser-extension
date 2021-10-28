import React from 'react';

import { CustomInputElement } from '../shared/types';
import LoaderAnimation from '../shared/components/LoaderAnimation';

interface HighlightsLoaderProps {
  elementReference: CustomInputElement;
}

const HighlightsLoader: React.FC<HighlightsLoaderProps> = ({
  elementReference,
}: HighlightsLoaderProps) => {
  const LOADER_RADIUS: number = 8;
  const elementsReferenceRect = elementReference.getBoundingClientRect();
  const elementReferenceStyle = window.getComputedStyle(elementReference);

  return (
    <div
      style={{
        position: 'fixed',
        top: `${elementsReferenceRect.top + LOADER_RADIUS}px`,
        left: `${
          elementsReferenceRect.left +
          parseInt(elementReferenceStyle.width) -
          LOADER_RADIUS * 3
        }px`,
      }}
    >
      <LoaderAnimation radius={LOADER_RADIUS} />
    </div>
  );
};

export default HighlightsLoader;
