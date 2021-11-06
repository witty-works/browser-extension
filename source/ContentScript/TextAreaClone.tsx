import React from 'react';
interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
  elementRect: DOMRect;
  updateClone: (clone: HTMLDivElement) => void;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
  elementRect,
  updateClone,
}: TextAreaCloneProps) => {
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
          top: `${elementRect.top}px`, //TODO would work define scrollTop property and not substract it here?
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
          // zIndex: 1,
          // outline: '5px solid red',
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
