import React, {useRef} from 'react';
import {Position} from '../shared/types';
import {getCorrectedPosition} from '../shared/utils';

interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
  elementRect: DOMRect;
  elementScroll: Position;
  updateClone: (clone: HTMLDivElement) => void;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
  elementRect,
  updateClone,
}: TextAreaCloneProps) => {
  const cloneRef = useRef<HTMLDivElement>({} as HTMLDivElement);
  const elementStyles = window.getComputedStyle(element);

  const correctedPosition = getCorrectedPosition(
    elementRect,
    cloneRef.current.parentElement,
    element
  );

  // The clone has to wrap its lines exactly where the textarea does, or every
  // highlight after the first differing line break lands on the wrong word.
  // So it mirrors the textarea's box: its full size as border-box, with each
  // border and padding as the textarea has them, whatever box-sizing the page
  // gives the textarea, and every property that decides where lines break.
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
          top: `${correctedPosition.top}px`,
          left: `${correctedPosition.left}px`,
          paddingTop: elementStyles.paddingTop,
          paddingLeft: elementStyles.paddingLeft,
          paddingRight: elementStyles.paddingRight,
          paddingBottom: elementStyles.paddingBottom,
          boxSizing: 'border-box',
          width: elementRect.width,
          height: elementRect.height,
          borderStyle: 'solid',
          borderColor: 'transparent',
          borderTopWidth: elementStyles.borderTopWidth,
          borderRightWidth: elementStyles.borderRightWidth,
          borderBottomWidth: elementStyles.borderBottomWidth,
          borderLeftWidth: elementStyles.borderLeftWidth,
          fontSize: elementStyles.fontSize,
          fontWeight: elementStyles.fontWeight,
          fontStyle: elementStyles.fontStyle,
          fontVariant: elementStyles.fontVariant,
          lineHeight: elementStyles.lineHeight,
          fontFamily: elementStyles.fontFamily,
          letterSpacing: elementStyles.letterSpacing,
          wordSpacing: elementStyles.wordSpacing,
          textIndent: elementStyles.textIndent,
          textTransform: elementStyles.textTransform,
          tabSize: elementStyles.tabSize,
          direction: elementStyles.direction,
          overflowWrap: elementStyles.overflowWrap,
          wordBreak: elementStyles.wordBreak,
          visibility: 'hidden',
          pointerEvents: 'none',
        } as React.CSSProperties
      }
    >
      {element.value}
    </div>
  );
};

export default TextAreaClone;
