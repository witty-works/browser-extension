import React, { useRef } from 'react';
import { CustomInputElement } from '../shared/types';

interface GoogleDocsCloneProps {
  element: CustomInputElement;
  updateClone: (clone: HTMLDivElement) => void;
}

const GoogleDocsClone: React.FC<GoogleDocsCloneProps> = ({
  element,
  updateClone,
}: GoogleDocsCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);

  const innerElement = element.childNodes[0] as CustomInputElement;

  const divs = [];
  for (let i = 0; i < innerElement.childNodes.length; i++) {
    const gElement = innerElement.childNodes[i] as CustomInputElement;
    for (let j = 0; j < gElement.childNodes.length; j++) {
      const rectElement = gElement.childNodes[j] as any; //TODO
      const rects = rectElement.getBoundingClientRect();
      const ariaLabel = gElement.querySelector('[aria-label]');
      divs.push(
        <div
          style={{
            visibility: 'hidden',
            width: rects.width + 'px',
            height: rects.height + 'px',
            top: rects.top + 'px',
            left: rects.y + 'px',
            fill: 'none',
            transform: 'matrix(1, 0, 0, 1, 96, 96)',
            fontSize: '16px', //TODO
          }}
        >
          {ariaLabel?.getAttribute('aria-label')}
        </div>
      );
    }
  }
  return (
    <div
      ref={(ref) => {
        if (ref !== null) {
          cloneRef.current = ref;
          updateClone(ref);
        }
      }}
    >
      {divs}
    </div>
  );
};

export default GoogleDocsClone;
