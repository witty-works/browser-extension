import React, { useRef } from 'react';
import { CustomInputElement } from '../shared/types';
import { getCorrectedPosition } from '../shared/utils';

interface GoogleDocsCloneProps {
  element: CustomInputElement;
  previousElement: {
    text: string[] | string;
    position: DOMRect;
  };
  updateClone: (clone: HTMLDivElement) => void;
}

const GoogleDocsClone: React.FC<GoogleDocsCloneProps> = ({
  element,
  previousElement,
  updateClone,
}: GoogleDocsCloneProps) => {

  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const divs = [] as JSX.Element[];
  const pages = element.querySelectorAll('.kix-page-paginated');
  const pageElementsContainingSvg = Array.from(pages).map(
    (page) => page.childNodes[1]
  );

  for (const pageElementContainingSvg of pageElementsContainingSvg) {
    const innerElement = pageElementContainingSvg
      .childNodes[0] as CustomInputElement;
    for (const childNode of innerElement.childNodes) {
      const gElement = childNode as CustomInputElement;
      for (const rectElement of gElement.childNodes) {
        const svgRectElement = rectElement as SVGRectElement;
        const areaLabel = svgRectElement.getAttribute('aria-label');
        const areaLabelSplit = areaLabel?.split(' ');
        areaLabelSplit?.forEach((label, index) => {
          if (label === '') {
            //multiple spaces in a row -> automatically truncated
            areaLabelSplit[index] = '\xa0';
          } else if (
            (index !== 0 || //dont add space if last character is a special character or the first char of next word is a special character
              index !== areaLabelSplit.length - 1) &&
            !areaLabelSplit[index]
              .charAt(areaLabelSplit[index].length - 1)
              ?.match(/[\(\[\"\'\“\-\_\`]/) &&
            !areaLabelSplit[index + 1]?.charAt(0)?.match(/[\)\]\"\'\”\-\_\`]/)
          ) {
            areaLabelSplit[index] = label + ' ';
          } else {
            areaLabelSplit[index] = label;
          }
        });
        const areaLabelPreserved = areaLabelSplit?.join('');

        const elementRect = svgRectElement.getBoundingClientRect();
        let elementStylesFont = svgRectElement.getAttribute('data-font-css');
        let elementStylesFontArray = [] as string[];
        const extractedFont = elementStylesFont?.match(/"([^"]+)"/);
        if (extractedFont && elementStylesFont) {
          elementStylesFont = elementStylesFont.replace(extractedFont[0], '');
          elementStylesFontArray = elementStylesFont.split(' ');
        }
        const elementStyles = window.getComputedStyle(svgRectElement);
        const correctedPosition = getCorrectedPosition(
          elementRect,
          element.parentElement,
          element
        );
        elementRect &&
          elementStylesFont &&
          divs.push(
            <div 
              // key={`${areaLabel?.slice(0, 10)}-${elementRect.width}-${elementRect.top}`} //LEFT OUT ON PURPOSE TO AVOID RE-RENDERING
              style={
                {
                  visibility: 'hidden',
                  width: elementRect.width + correctedPosition.left,
                  height: elementRect.height,
                  fontWeight:
                    elementStylesFontArray[elementStylesFontArray.length - 3],
                  fontSize:
                    elementStylesFontArray[elementStylesFontArray.length - 2],
                  fontFamily: extractedFont
                    ? extractedFont[1]
                    : elementStyles.fontFamily,
                  fontStyle:
                    elementStylesFontArray.length > 3
                      ? elementStylesFontArray[
                          elementStylesFontArray.length - 4
                        ]
                      : elementStyles.fontStyle,
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
                  // zIndex: zIndex,
                } as React.CSSProperties
              }
            >
              {areaLabelPreserved}
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
          const isDifferent = refAsArrayOfText.some(
            (text, index) => text !== previousElement.text[index]
          );

          const elementRects = element.getBoundingClientRect();
          const positionChanged =
            previousElement.position.top !== elementRects.top ||
            previousElement.position.left !== elementRects.left ||
            previousElement.position.width !== elementRects.width ||
            previousElement.position.height !== elementRects.height;

          if (isDifferent || positionChanged) {
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
