import { textIsLight } from '../shared/utils';
import chroma from 'chroma-js';

export const drawLine = (params: any, color: string, dashedLine: boolean) => {
  const { context, rect, elementRect } = params;
  let x = rect.left - elementRect.left;
  let y = rect.top - elementRect.top;

  context.beginPath();
  dashedLine ? context.setLineDash([0, 4]) : context.setLineDash([0, 0]);
  context.lineCap = 'round';
  context.moveTo(x, y + rect.height);
  context.lineTo(x + rect.width, y + rect.height);
  dashedLine ? (context.lineWidth = 3) : (context.lineWidth = 2);
  context.strokeStyle = color;
  context.stroke();
};

export const drawHighlight = (params: any, color: string) => {
  const { roundedHighlight, context, rect, elementRect } = params;
  //the +/- is to add some padding to the highlight
  let x = rect.left - elementRect.left - 1.5;
  let y = rect.top - elementRect.top + 1;
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
  context.fill(roundedHighlight);
};

export const redrawText = (params: any) => {
  const { context, highlight, rect, elementRect } = params;
  let x = rect.left - elementRect.left;
  let y = rect.top - elementRect.top + rect.height;

  const style = window.getComputedStyle(highlight.node.parentElement);
  const color = textIsLight(style.color)
    ? 'black'
    : chroma(style.color).set('lch.c', '*2');

  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fillStyle = color;
  context.textBaseline = 'bottom';
  context.fillText(highlight.data.text, x, y);
};
