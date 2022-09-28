import React, { useRef } from 'react';
import { CustomInputElement } from '../shared/types';
import { getCorrectedPosition } from '../shared/utils';

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
      const elementRect = rectElement.getBoundingClientRect();
      const ariaLabel = gElement.querySelector('[aria-label]');

      //extract style from rectElement
      const elementStyles = window.getComputedStyle(rectElement);

      // const elementRect = useResizeObserver(rectElement);
      const correctedPosition = getCorrectedPosition(
        elementRect,
        cloneRef.current.parentElement,
        element
      );

      divs.push(
        <div
          style={
            {
              visibility: 'hidden',
              width: elementRect.width + 'px',
              height: elementRect.height + 'px',
              fill: 'none',
              // transform: elementStyles.transform,
              fontSize: elementStyles.fontSize,
              // fontWeight: rectStyle.fontWeight,
              lineHeight: elementStyles.lineHeight,
              fontFamily: elementStyles.fontFamily,
              appearance: 'textarea',
              whiteSpace: 'pre-wrap',
              position: 'absolute',
              overflow: 'auto',
              top: `${correctedPosition.top}px`,
              left: `${correctedPosition.left}px`,
              paddingTop: elementStyles.paddingTop,
              paddingLeft: elementStyles.paddingLeft,
              paddingRight: elementStyles.paddingRight,
              paddingBottom: elementStyles.paddingBottom,
              fontWeight: elementStyles.fontWeight,
              border: `${elementStyles.borderBottomWidth} solid black`,
              pointerEvents: 'none',
              boxSizing: elementStyles.boxSizing,
            } as React.CSSProperties
          }
        >
          {ariaLabel?.getAttribute('aria-label')}
        </div>
      );
    }
  }
  return (
    <div
      ref={(ref) => {
        if (ref !== null && divs.length > 0) {
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
