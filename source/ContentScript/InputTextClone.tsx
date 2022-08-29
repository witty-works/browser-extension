import React, { useRef } from 'react';
import { getCorrectedPosition } from '../shared/utils';

interface InputTextCloneProps {
  element: HTMLInputElement;
  elementRect: DOMRect;
  updateClone: (clone: HTMLDivElement) => void;
}

const InputTextClone: React.FC<InputTextCloneProps> = ({
  element,
  elementRect,
  updateClone,
}: InputTextCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const elementStyle = window.getComputedStyle(element);
  const correctedPosition = getCorrectedPosition(
    elementRect,
    cloneRef.current.parentElement,
    element
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
          width: elementRect.width,
          height: elementRect.height,
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
