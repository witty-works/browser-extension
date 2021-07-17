import React, { useEffect, useState } from 'react';
// import Highlights from './Highlights';
import { HighlightProps } from './Highlights';

export interface CarbonCopyTextareaProps {
  element: HTMLTextAreaElement | HTMLInputElement;
}

interface Alert {
  startOffset: number;
  endOffset: number;
  id: string;
}

// interface Highlight {
//   rect: DOMRect;
// }

const initialHighlights = { rects: [] };

const CarbonCopyTextarea: React.FC<CarbonCopyTextareaProps> = ({
  element,
}: CarbonCopyTextareaProps) => {
  // const [alerts, setAlerts] = useState<Alert[]>([]);
  // const [text, setText] = useState<string | null>('');
  const [highlightsOld, setHighlightsOld] =
    useState<HighlightProps>(initialHighlights);
  const [highlights, setHighlights] =
    useState<HighlightProps>(initialHighlights);

  // const highlights: DOMRect[] = [];

  const style = window.getComputedStyle(element);

  const checkText = (text: string): Alert[] => {
    const tokens = text.split(/([\s,.!?]+)/g);
    const alerts: Alert[] = [];
    let curPos = 0;
    let id = 0;

    tokens.forEach((t) => {
      if (t.trim().length > 0) {
        alerts.push({
          id: (id++).toString(),
          startOffset: curPos,
          endOffset: curPos + t.length,
        });
      }

      curPos += t.length;
    });

    return alerts;
  };

  const checkContent = (elem: HTMLElement) => {
    if (highlightsOld != highlights) {
      setHighlightsOld(highlights);
      return false;
    }

    console.log('refref! ', elem);

    const results = checkText(elem.textContent || '');
    // setText(elem.textContent);

    const nodeText = elem.childNodes[0];

    const rects = results.map((result) => {
      const range = document.createRange();

      range.setStart(nodeText, result.startOffset);
      range.setEnd(nodeText, result.endOffset);
      const rect = range.getClientRects()[0];
      console.log('rect = ', rect);

      return rect;
    });

    setHighlights({
      rects,
    });
  };

  // const updateHighlights = (elem: HTMLElement, alerts: Alert[]) => {
  //   console.log('update HS');

  //   alerts.forEach((alert) => {
  //     // console.log('alert: ', alert);

  //     const range = document.createRange();
  //     const nodeText = elem.childNodes[0];

  //     range.setStart(nodeText, alert.startOffset);
  //     range.setEnd(nodeText, alert.endOffset);
  //     const rect = range.getClientRects()[0];
  //     console.log('rect = ', rect);

  //     // setHighlights((prevHighlights) => ({
  //     //   rects: [...prevHighlights.rects, rect],
  //     // }));
  //   });

  //   // console.log('highlights = ', highlights);
  // };

  return (
    <div>
      <div
        // contentEditable={true}
        ref={(ref) => {
          if (ref !== null) checkContent(ref);
        }}
        spellCheck={false}
        style={{
          appearance: 'textarea',
          whiteSpace: 'pre-wrap',
          position: 'absolute',
          visibility: 'hidden',
          top: `${element.offsetTop + element.clientTop}px`,
          left: `${element.offsetLeft + element.clientLeft}px`,
          paddingTop: style.paddingTop,
          paddingLeft: style.paddingLeft,
        }}
      >
        {element.value}
      </div>
      {/* <Highlights rects={highlights.rects} /> */}
    </div>
  );
};

export default CarbonCopyTextarea;
