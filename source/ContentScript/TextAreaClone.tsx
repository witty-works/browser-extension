import React from 'react';
interface TextAreaCloneProps {
  element: HTMLTextAreaElement;
  updateClone: (clone: HTMLDivElement) => void;
}

const TextAreaClone: React.FC<TextAreaCloneProps> = ({
  element,
  updateClone,
}: TextAreaCloneProps) => {
  const elementStyle = window.getComputedStyle(element);
  const elementBoundingClientRect = element.getBoundingClientRect();

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
          position: 'fixed',
          overflow: 'auto',
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
          // zIndex: 1,
          // outline: '3px solid red',
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

// import React from 'react';

// export interface TextAreaCloneProps {
//   element: HTMLTextAreaElement;
//   updateClone: (
//     textAreaElement: HTMLTextAreaElement,
//     divElement: HTMLDivElement
//   ) => void;
// }

// const TextAreaClone: React.FC<TextAreaCloneProps> = ({
//   element,
//   updateClone,
// }: TextAreaCloneProps) => {
//   const elementStyle = window.getComputedStyle(element);
//   const elementBoundingClientRect = element.getBoundingClientRect();

//   return (
//     <>
//       <div
//         ref={(ref) => {
//           if (ref !== null) {
//             updateClone(element, ref as HTMLDivElement);
//           }
//         }}
//         spellCheck={false}
//         style={
//           {
//             appearance: 'textarea',
//             whiteSpace: 'pre-wrap',
//             position: 'fixed',
//             overflow: 'auto',
//             top: `${elementBoundingClientRect.top - element.scrollTop}px`, //TODO would work define scrollTop property and not substract it here?
//             left: `${elementBoundingClientRect.left - element.scrollLeft}px`,
//             paddingTop: elementStyle.paddingTop,
//             paddingLeft: elementStyle.paddingLeft,
//             paddingRight: elementStyle.paddingRight,
//             paddingBottom: elementStyle.paddingBottom,
//             width: elementStyle.width,
//             height: elementStyle.height,
//             fontSize: elementStyle.fontSize,
//             fontWeight: elementStyle.fontWeight,
//             lineHeight: elementStyle.lineHeight,
//             fontFamily: elementStyle.fontFamily,
//             border: `${elementStyle.borderBottomWidth} solid black`,
//             visibility: 'hidden',
//             // zIndex: 1,
//             // outline: '3px solid red',
//             // top: `${
//             //   elementBoundingClientRect.top -
//             //   element.scrollTop +
//             //   elementBoundingClientRect.height +
//             //   50
//             // }px`,
//           } as React.CSSProperties
//         }
//       >
//         {element.value}
//       </div>
//     </>
//   );
// };

// export default TextAreaClone;
