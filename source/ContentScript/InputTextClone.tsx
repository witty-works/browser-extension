import React, { useRef } from 'react';

import { usePositionCorrection } from '../shared/customHooks/usePositionCorrection';
interface InputTextCloneProps {
  element: HTMLInputElement;
  updateClone: (clone: HTMLDivElement) => void;
}

const InputTextClone: React.FC<InputTextCloneProps> = ({
  element,
  updateClone,
}: InputTextCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const elementStyle = window.getComputedStyle(element);
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
          paddingTop: elementStyle.paddingTop,
          paddingLeft: elementStyle.paddingLeft,
          paddingRight: elementStyle.paddingRight,
          paddingBottom: elementStyle.paddingBottom,
          width: elementStyle.width,
          height: elementStyle.height,
          fontSize: elementStyle.fontSize,
          fontWeight: elementStyle.fontWeight,
          lineHeight: elementStyle.lineHeight,
          fontFamily: elementStyle.fontFamily,
          border: `${elementStyle.borderBottomWidth} solid black`,
          visibility: 'hidden',
          pointerEvents: 'none',
        } as React.CSSProperties
      }
    >
      {element.value}
    </div>
  );
};

export default InputTextClone;
