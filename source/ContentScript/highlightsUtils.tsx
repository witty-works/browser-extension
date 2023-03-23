import { isGoogleDocs } from '../shared/DOMutils';
import { Highlight } from '../shared/types';

export const drawLine = (params: any, color: string, dashedLine: boolean) => {
  const { context, rect, elementRect } = params;

  let x = rect.left - elementRect.left;
  let y = rect.top - elementRect.top;
  if (isGoogleDocs()) {
    x = rect.left;
  }

  context.beginPath();
  dashedLine ? context.setLineDash([0, 4]) : context.setLineDash([0, 0]);
  context.lineCap = 'round';
  context.moveTo(x, y + rect.height);
  context.lineTo(x + rect.width, y + rect.height);
  dashedLine ? (context.lineWidth = 3) : (context.lineWidth = 2);
  context.strokeStyle = color;
  context.globalAlpha = 1;
  context.stroke();
};

export const drawHighlight = (params: any, color: string) => {
  const { roundedHighlight, context, rect, elementRect } = params;
  //the +/- is to add some padding to the highlight
  let x = rect.left - elementRect.left - 1.5;
  let y = rect.top - elementRect.top + 1;
  if (isGoogleDocs()) {
    x = rect.left;
  }

  let width = rect.width + 3;
  let height = rect.height - 1;
  let radius = 4;

  context.clearRect(x - 1, y, width + 2, height + 2); // clear the previous rectangle
  roundedHighlight.moveTo(x + radius, y);
  roundedHighlight.arcTo(x + width, y, x + width, y + height, radius);
  roundedHighlight.arcTo(x + width, y + height, x, y + height, radius);
  roundedHighlight.arcTo(x, y + height, x, y, radius);
  roundedHighlight.arcTo(x, y, x + width, y, radius);
  roundedHighlight.closePath();

  context.fillStyle = color;
  context.globalAlpha = 0.2;
  context.fill(roundedHighlight);
};

export const getGreenhouseHeight = (highlights: Highlight[]) => {
  if (
    !highlights ||
    !highlights[highlights.length - 1] ||
    !highlights[highlights.length - 1].rects[0]
  )
    return 0;
  return (
    highlights[highlights.length - 1].rects[0].top -
    highlights[0].rects[0].top +
    50
  );
};
