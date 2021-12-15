import React from 'react';
import { ScrollPos } from './Highlights';
interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
  elementRect: DOMRect;
  elementScroll: ScrollPos;
  updateClone: (clone: HTMLDivElement) => void;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
  elementRect,
  elementScroll,
  updateClone,
}: TextAreaCloneProps) => {
  const elementStyle = window.getComputedStyle(element);

  console.log('TextAreaClone elementRect.top', elementRect.top);
  console.log('TextAreaClone element.scrollTop', element.scrollTop);


  return (
    <div
      ref={(ref) => {
        if (ref !== null) {
          ref.scrollLeft = element.scrollLeft
          ref.scrollTop = element.scrollTop
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
          top: `${elementRect.top}px`,
          left: `${elementRect.left}px`,
          // top: `${elementRect.top - elementScroll.top}px`,
          // left: `${elementRect.left - elementScroll.left}px`,
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
          // visibility: 'hidden',
          // outline: '8px solid red',
          pointerEvents: 'none',
          zIndex: -1,
          // top: `${
          //   elementBoundingClientRect.top -
          //   element.scrollTop +
          //   elementBoundingClientRect.height +
          //   50
          // }px`,
        } as React.CSSProperties
      }
    >
      {element.value}
    </div>
  );
};

export default TextAreaClone;
