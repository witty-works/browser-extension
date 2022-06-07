import React, { useRef } from 'react';
import { Position } from '../shared/types';
import { usePositionCorrection } from '../shared/customHooks/usePositionCorrection';

interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
  elementScroll: Position;
  updateClone: (clone: HTMLDivElement) => void;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
  updateClone,
}: TextAreaCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const elementStyles = window.getComputedStyle(element);

  const correctedPosition = usePositionCorrection(
    element,
    cloneRef.current.parentElement
  );

  return (
    <div
      ref={(ref) => {
        if (ref !== null) {
          cloneRef.current = ref;
          updateClone(ref);
        }
      }}
      spellCheck={false}
      style={
        {
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
          width: elementStyles.width,
          height: elementStyles.height,
          fontSize: elementStyles.fontSize,
          fontWeight: elementStyles.fontWeight,
          lineHeight: elementStyles.lineHeight,
          fontFamily: elementStyles.fontFamily,
          border: `${elementStyles.borderBottomWidth} solid black`,
          visibility: 'hidden',
          pointerEvents: 'none',
          boxSizing: elementStyles.boxSizing,
        } as React.CSSProperties
      }
    >
      {element.value}
    </div>
  );
};

export default TextAreaClone;
