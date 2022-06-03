import React from 'react';
interface GoogleDocProps {
  element: HTMLInputElement;
  elementRect: DOMRect;
  updateClone: (clone: HTMLDivElement) => void;
}

const GoogleDocClone: React.FC<GoogleDocProps> = ({
  element,
  elementRect,
  updateClone,
}: GoogleDocProps) => {
  const elementStyle = window.getComputedStyle(element);

  const rect = element.firstChild as Element;
  const font = rect.getAttribute('data-font-css');
  const fontSize = font?.split(' ')[1];
  const fontFamily = font?.split(' ')[3];
  const fontWeight = font?.split(' ')[0];

  const text: string = Array.from(element.children)
    .map((child) => {
      if (child.getAttribute('aria-label')) {
        return child.getAttribute('aria-label');
      } else {
        return '';
      }
    })
    .join(' ');

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
          fontSize: fontSize,
          fontWeight: fontWeight,
          lineHeight: elementStyle.lineHeight,
          fontFamily: fontFamily,
          border: `${elementStyle.borderBottomWidth} solid black`,
          visibility: 'hidden',
        } as React.CSSProperties
      }
    >
      {text}
    </div>
  );
};
export default GoogleDocClone;
