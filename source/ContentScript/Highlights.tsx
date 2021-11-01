import React, { useEffect, useRef } from 'react';
import { IAlert, IAlertContentData } from '../shared/types';
import { getColor } from '../shared/constants';

interface HighlightsProps {
  element: HTMLDivElement;
  alerts: IAlert[];
}

// type ConvertedAlert = {
//   node: HTMLElement;
//   start: number;
//   end: number;
// };

type Highlight = {
  // alertID: string;
  rect: DOMRect;
  data: IAlertContentData;
};

const Highlights: React.FC<HighlightsProps> = ({
  element,
  alerts,
}: HighlightsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);
  // const [convertedAlerts, setConvertedAlerts] = useState<ConvertedAlert[]>([]);
  // const [highlights, setHighlights] = useState<Highlight[]>([]);

  // useEffect(() => {
  //   console.log('Highlights useEffect element = ', element);
  // }, [element]);

  useEffect(() => {
    console.log('Highlights ALERTS = ', alerts);

    const childNodes: NodeListOf<ChildNode> = element.childNodes;
    console.log('Highlights childNodes = ', childNodes);

    const highlights: Highlight[] = [];

    const convertAlert = (
      node: ChildNode,
      nodeStartPos: number,
      nodeEndPos: number
    ): void => {
      alerts.forEach((alert: IAlert) => {
        if (
          alert.startOffset >= nodeStartPos &&
          alert.endOffset <= nodeEndPos
        ) {
          const newStartingPos: number = alert.startOffset - nodeStartPos;
          const newEndPos: number = alert.endOffset - nodeStartPos;

          const range = document.createRange();
          range.setStart(node, newStartingPos);
          range.setEnd(node, newEndPos);
          const rect = range.getClientRects()[0];

          console.log('Highlights rect = ', rect);

          const newHighlight: Highlight = {
            rect,
            data: alert.data,
          };

          highlights.push(newHighlight);
        }
      });
    };

    let textstartingPosition: number = 0;
    let textEndPosition: number = 0;

    const traverseNodes = (nodes: NodeListOf<ChildNode>) => {
      for (let node of nodes) {
        console.log('*** Highlights node = ', node);
        textstartingPosition = textEndPosition;
        console.log(
          '*** Highlights textstartingPosition = ',
          textstartingPosition
        );
        if (node.nodeName === '#text') {
          if (node.nodeValue) {
            console.log('*** Highlights text = ', node.nodeValue);
            const nodeValueLength = node.nodeValue.length;
            textEndPosition = textstartingPosition + nodeValueLength;
            console.log('*** Highlights textEndPosition 1 = ', textEndPosition);
            convertAlert(node, textstartingPosition, textEndPosition);
          }
        } else {
          if (node.nodeName === 'DIV' || node.nodeName === 'BR')
            textEndPosition++;
          console.log('*** Highlights textEndPosition 2 = ', textEndPosition);

          if (node.childNodes.length > 0) {
            traverseNodes(node.childNodes);
          }
        }
      }
    };

    traverseNodes(childNodes);

    if (highlights.length === alerts.length) {
      console.log('--->>> Highlights highlights = ', highlights);

      const canvas: HTMLCanvasElement = canvasRef.current;

      if (canvas && canvas.getContext) {
        const elementToTrack = element; //TODO temporal...
        const elementToTrackRect = elementToTrack.getBoundingClientRect();

        const context: CanvasRenderingContext2D | null =
          canvas.getContext('2d');
        if (context) {
          //Clear the whole canvas first
          context.clearRect(0, 0, canvas.width, canvas.height);

          //Draw a rectangle for each highlight
          highlights.forEach((highlight) => {
            context.fillStyle = `${getColor(highlight.data.category)}`;
            const highlightRect = highlight.rect;
            const rectToRender: DOMRect = {
              x: highlightRect.x - elementToTrackRect.x,
              y: highlightRect.y - canvas.offsetTop + highlightRect.height,
              width: highlightRect.width,
              height: 2,
            } as DOMRect;

            context.fillRect(
              rectToRender.x,
              rectToRender.y,
              rectToRender.width,
              rectToRender.height
            );
          });
        }
      } else {
        //TODO Provide Canvas Fallback content?
        //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
      }
    }
  }, [alerts]);

  return (
    <canvas
      ref={canvasRef}
      style={
        {
          position: 'fixed',
          overflow: 'auto',
          top: `${element.getBoundingClientRect().top}px`,
          left: `${element.getBoundingClientRect().left}px`,
          pointerEvents: 'none',
          zIndex: 999999999,
          // outline: '3px solid blue',
        } as React.CSSProperties
      }
      width={element.getBoundingClientRect().width}
      height={element.getBoundingClientRect().height}
    ></canvas>
  );
};

export default Highlights;

// import React, { useEffect, useRef } from 'react';
// import { Iinput, IAlert, IAlertContentData } from '../shared/types';

// import { getColor } from '../shared/constants';
// import { isObjectEmpty } from '../shared/utils';

// type Highlight = {
//   alertID: string;
//   rect: DOMRect;
//   data: IAlertContentData;
// };

// const Highlights: React.FC<Iinput> = ({
//   cloneElement,
//   inputElement,
//   alerts,
// }: Iinput) => {
//   const canvasRef = useRef<HTMLCanvasElement>({} as HTMLCanvasElement);

//   const getElementToTrack = () => {
//     return typeof inputElement === 'undefined' || inputElement === null
//       ? cloneElement
//       : inputElement;
//   };

//   useEffect(() => {
//     const elementToTrack = getElementToTrack();

//     if (cloneElement.childNodes) {
//       const elementToTrackRect = elementToTrack.getBoundingClientRect();

//       let nodeText: Node = cloneElement.childNodes[0];

//       const highlights: Highlight[] = alerts
//         .filter(
//           //filter out repeating cases
//           (alert: IAlert, index: number, array: IAlert[]) =>
//             array.findIndex(
//               (item) =>
//                 item.data.text === alert.data.text &&
//                 item.startOffset === alert.startOffset &&
//                 item.endOffset === alert.endOffset
//             ) === index
//         )
//         .map((alert: IAlert) => {
//           try {
//             const range = document.createRange();
//             range.setStart(nodeText, alert.startOffset);
//             range.setEnd(nodeText, alert.endOffset);
//             const rect = range.getClientRects()[0];
//             return {
//               alertID: alert.id,
//               rect,
//               data: alert.data,
//             };
//           } catch (error) {
//             //Offset is larger than node's length
//             //so just return an object without a defined DOMRect
//             return {
//               alertID: alert.id,
//               rect: {} as DOMRect,
//               data: alert.data,
//             };
//           }
//         })
//         .filter((alert: Highlight) => {
//           return (
//             !isObjectEmpty(alert.rect) &&
//             alert.rect.top + alert.rect.height > elementToTrackRect.top &&
//             alert.rect.top + alert.rect.height <
//               elementToTrackRect.top + elementToTrackRect.height &&
//             alert.rect.left > elementToTrackRect.left &&
//             alert.rect.left + alert.rect.width <
//               elementToTrackRect.left + elementToTrackRect.width
//           );
//         });

//       const canvas: HTMLCanvasElement = canvasRef.current;

//       if (canvas && canvas.getContext) {
//         const context: CanvasRenderingContext2D | null =
//           canvas.getContext('2d');
//         if (context) {
//           //Clear the whole canvas first
//           context.clearRect(0, 0, canvas.width, canvas.height);

//           //Draw a rectangle for each highlight
//           highlights.forEach((highlight) => {
//             context.fillStyle = `${getColor(highlight.data.category)}`;
//             const highlightRect = highlight.rect;
//             const rectToRender: DOMRect = {
//               x: highlightRect.x - elementToTrackRect.x,
//               y: highlightRect.y - canvas.offsetTop + highlightRect.height,
//               width: highlightRect.width,
//               height: 2,
//             } as DOMRect;

//             context.fillRect(
//               rectToRender.x,
//               rectToRender.y,
//               rectToRender.width,
//               rectToRender.height
//             );
//           });
//         }
//       } else {
//         //TODO Provide Canvas Fallback content?
//         //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage
//       }
//     }
//   }, [Object.keys(cloneElement), inputElement, alerts]);

//   return getElementToTrack() && alerts.length > 0 ? (
//     <canvas
//       ref={canvasRef}
//       style={
//         {
//           position: 'fixed',
//           overflow: 'auto',
//           top: `${getElementToTrack().getBoundingClientRect().top}px`,
//           left: `${getElementToTrack().getBoundingClientRect().left}px`,
//           pointerEvents: 'none',
//           zIndex: 999999999,
//           // outline: '3px solid blue',
//         } as React.CSSProperties
//       }
//       width={getElementToTrack().getBoundingClientRect().width}
//       height={getElementToTrack().getBoundingClientRect().height}
//     ></canvas>
//   ) : null;
// };

// export default Highlights;
