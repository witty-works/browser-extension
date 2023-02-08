import React, { useRef } from 'react';
import { CustomInputElement } from '../shared/types';
import { getCorrectedPosition } from '../shared/utils';

interface GoogleDocsCloneProps {
  element: CustomInputElement;
  previousElement: string[] | string;
  updateClone: (clone: HTMLDivElement) => void;
}

const GoogleDocsClone: React.FC<GoogleDocsCloneProps> = ({
  element,
  previousElement,
  updateClone,
}: GoogleDocsCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const divs = [];
  const pages = element.querySelectorAll('.kix-page-paginated');

  //get 3d child of each page
  const pageElementsContainingSvg = Array.from(pages).map(
    (page) => page.childNodes[2]
  );

  for (const pageElementContainingSvg of pageElementsContainingSvg) {
    const innerElement = pageElementContainingSvg
      .childNodes[0] as CustomInputElement;
    for (const childNode of innerElement.childNodes) {
      const gElement = childNode as CustomInputElement;
      for (const rectElement of gElement.childNodes) {
        const svgRectElement = rectElement as SVGRectElement;
        const areaLabel = svgRectElement.getAttribute('aria-label');
        const elementRect = svgRectElement.getBoundingClientRect();
        const elementStylesFont = svgRectElement.getAttribute('data-font-css');
        const elementStyles = window.getComputedStyle(svgRectElement);
        const correctedPosition = getCorrectedPosition(
          elementRect,
          element.parentElement,
          element
        );
        elementRect &&
          divs.push(
            <div
              key={`${areaLabel}-${elementRect.top}-${elementRect.left}`}
              style={
                {
                  visibility: 'hidden',
                  width: elementRect.width + correctedPosition.left,
                  height: elementRect.height,
                  fontWeight: elementStylesFont?.split(' ')[0],
                  fontSize: elementStylesFont?.split(' ')[1],
                  fontFamily: elementStylesFont?.split(' ')[2],
                  lineHeight: elementStyles.lineHeight,
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
                } as React.CSSProperties
              }
            >
              {areaLabel}
            </div>
          );
      }
    }
  }
  return (
    <div
      ref={(ref) => {
        if (ref !== null && divs.length > 0) {
          const refAsArrayOfText = Array.from(ref.childNodes).map(
            (node) => node.textContent
          );
          //update clone only if text changed
          const isDifferent = refAsArrayOfText.some(
            (text, index) => text !== previousElement[index]
          );
          if (isDifferent) {
            cloneRef.current = ref;
            updateClone(ref);
          }
        }
      }}
    >
      {divs}
    </div>
  );
};

export default GoogleDocsClone;
