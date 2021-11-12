import React from 'react';
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
  const elementStyle = window.getComputedStyle(element);

  return (
    <div
      ref={(ref) => {
        if (ref !== null) {
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
          // outline: '5px solid red',
          // pointerEvents: 'none',
          // zIndex: 1,
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

export default InputTextClone;
