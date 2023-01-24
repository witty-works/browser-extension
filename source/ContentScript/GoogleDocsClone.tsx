import React, { useRef } from 'react';
import { CustomInputElement } from '../shared/types';
import { getCorrectedPosition } from '../shared/utils';

interface GoogleDocsCloneProps {
  element: CustomInputElement;
  previousElement: string[];
  updateClone: (clone: HTMLDivElement) => void;
}

const GoogleDocsClone: React.FC<GoogleDocsCloneProps> = ({
  element,
  previousElement,
  updateClone,
}: GoogleDocsCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const innerElement = element.childNodes[0] as CustomInputElement;
  const divs = [];

  for (const childNode of innerElement.childNodes) {
    const gElement = childNode as CustomInputElement;
    for (const rectElement of gElement.childNodes) {
      console.log('rectElement', rectElement);
      const svgRectElement = rectElement as SVGRectElement;
      //get aria-label from rectElement
      const areaLabel = svgRectElement.getAttribute('aria-label');
      console.log('areaLabel', areaLabel);
      const elementRect = svgRectElement.getBoundingClientRect();
      const elementStylesFont = gElement.querySelector('[data-font-css]');
      const elementStyles = window.getComputedStyle(svgRectElement);
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
              fontWeight: elementStylesFont
                ?.getAttribute('data-font-css')
                ?.split(' ')[0],
              fontSize: elementStylesFont
                ?.getAttribute('data-font-css')
                ?.split(' ')[1],
              font: elementStylesFont
                ?.getAttribute('data-font-css')
                ?.split(' ')[2],
              lineHeight: elementStyles.lineHeight,
              fontFamily: elementStyles.fontFamily,
              position: 'absolute',
              top: `${correctedPosition.top}px`,
              left: `${correctedPosition.left}px`,
              paddingTop: elementStyles.paddingTop,
              paddingLeft: elementStyles.paddingLeft,
              paddingRight: elementStyles.paddingRight,
              paddingBottom: elementStyles.paddingBottom,
              border: `${elementStyles.borderBottomWidth} solid black`,
              boxSizing: elementStyles.boxSizing,
              letterSpacing: elementStyles.letterSpacing,
              // transform: elementStyles.transform,
            } as React.CSSProperties
          }
        >
          {areaLabel}
        </div>
      );
    }
  }
  return (
    <div
      ref={(ref) => {
        if (ref !== null && divs.length > 0) {
          const refAsArrayOfText = Array.from(ref.childNodes).map(
            (node) => node.textContent
          );
          //update clone if refAsArrayOfText is different from previousElement
          const isDifferent = refAsArrayOfText.some(
            (text, index) => text !== previousElement[index]
          );
          console.log('IS DIFFERENT', isDifferent);
          // if (isDifferent) {
          cloneRef.current = ref;

          updateClone(ref);
          // }
        }
      }}
    >
      {divs}
    </div>
  );
};

export default GoogleDocsClone;
