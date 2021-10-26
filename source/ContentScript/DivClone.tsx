import React from 'react';

import { convertHTMLToText } from '../shared/utils';

export interface DivCloneProps {
  element: HTMLDivElement;
  updateClone: (
    originalDivElement: HTMLDivElement,
    divElement: HTMLDivElement
  ) => void;
}

const DivClone: React.FC<DivCloneProps> = ({
  element,
  updateClone,
}: DivCloneProps) => {
  const elementStyle = window.getComputedStyle(element);
  const elementBoundingClientRect = element.getBoundingClientRect();

  return (
    <>
      <div
        ref={(ref) => {
          if (ref !== null) {
            updateClone(element, ref as HTMLDivElement);
          }
        }}
        spellCheck={false}
        style={
          {
            // display: 'flex',
            whiteSpace: 'pre-wrap',
            position: 'fixed',
            overflow: elementStyle.overflow,
            top: `${elementBoundingClientRect.top - element.scrollTop}px`, //TODO would work define scrollTop property and not substract it here?
            left: `${elementBoundingClientRect.left - element.scrollLeft}px`,
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
            // color: 'red',
            // zIndex: 1,
            // outline: '3px solid red',
          } as React.CSSProperties
        }
      >
        {convertHTMLToText(element.innerHTML)}
      </div>
    </>
  );
};

export default DivClone;
