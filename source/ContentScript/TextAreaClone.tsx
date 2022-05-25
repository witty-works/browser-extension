import React, { useRef } from 'react';
import { ScrollPos } from '../shared/types';
interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
  elementScroll: ScrollPos;
  updateClone: (clone: HTMLDivElement) => void;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
  updateClone,
}: TextAreaCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const elementStyles = window.getComputedStyle(element);

  const calculatePositionCorrection = () => {
    const elementRect: DOMRect = element.getBoundingClientRect();

    return cloneRef.current.parentElement
      ? {
          top:
            elementRect.top -
            cloneRef.current.parentElement.getBoundingClientRect().top,
          left:
            elementRect.left -
            cloneRef.current.parentElement.getBoundingClientRect().left,
        }
      : {
          top: elementRect.top,
          left: elementRect.left,
        };
  };

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
          top: `${calculatePositionCorrection().top}px`,
          left: `${calculatePositionCorrection().left}px`,
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
