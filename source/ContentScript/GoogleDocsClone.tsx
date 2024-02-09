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
  let pages = element.querySelectorAll('.kix-page-paginated') 
  if(pages.length === 0) {
    pages = element?.childNodes[0]?.childNodes as NodeListOf<Element>; //for pageless format
  }
  //find index of child of pages that has a grandchild containing g
  const childNodeIndex = Array.from(pages).map((page) =>
    Array.from(page?.childNodes).findIndex(
      (childNode) =>
        childNode?.childNodes[0]?.childNodes[0]?.nodeName === 'g'
    )
  );

  //get 3d child of each page
  const pageElementsContainingSvg = Array.from(pages).map(
    (page) => page?.childNodes[childNodeIndex[0]]
  );

  for (const pageElementContainingSvg of pageElementsContainingSvg) {
    const innerElement = pageElementContainingSvg?.childNodes[0] as CustomInputElement;
    if (!innerElement?.childNodes) continue;
    for (const childNode of innerElement.childNodes) {
      const gElement = childNode as CustomInputElement;
      if (!gElement?.childNodes) continue;
      for (const rectElement of gElement.childNodes) {
        const svgRectElement = rectElement as SVGRectElement;
        const areaLabel = svgRectElement.getAttribute('aria-label');
        const areaLabelSplit = areaLabel?.split(' ');
        areaLabelSplit?.forEach((label, index) => {
          if (label === '') {
            areaLabelSplit[index] = '\xa0'; //multiple spaces in a row -> automatically truncated
          } else if (areaLabelSplit[index].length == 1 && !areaLabelSplit[index].match(/[a-zA-Z]/)) { //not alfabetical character
            areaLabelSplit[index] = ' ' + label + ' '; //single character -> add space before and after
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
        const extractedTransform = svgRectElement.getAttribute('transform');

        let scaleX = 1;
        if (extractedTransform) {
            const matrixMatch = extractedTransform.match(/matrix\(([^,]+),[^,]+,[^,]+,([^,]+),[^,]+,[^,]+\)/);
            if (matrixMatch) {
                scaleX = parseFloat(matrixMatch[1]);
            }
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
                  fontSize: `${parseFloat(elementStylesFontArray[elementStylesFontArray.length - 2]) * scaleX}px`,
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
        if (ref !== null && divs.length > 0 && previousElement) {
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