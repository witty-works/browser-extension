import chroma from 'chroma-js';
import { CustomInputElement } from './types';

const isObjectEmpty = (obj: object) =>
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

const isFunction = (functionToCheck: Function) =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';

const isTextArea = (
  element: CustomInputElement
): element is HTMLTextAreaElement => element instanceof HTMLTextAreaElement;

const isInputText = (
  element: CustomInputElement
): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'text';

//Ignore anything that is not a TextArea, an Input type=text or a contenteditable
const isInputElement = (element: CustomInputElement) =>
  isTextArea(element) ||
  // isInputText(element) ||      Temporaly disabled as it could capture passwords
  element.isContentEditable;

const convertHTMLToText = (str: string = ''): string => {
  // Ensure string.
  let value: string = String(str);
  // console.log('convertHTMLToText value 0',value);

  //remove all html attributes
  // value = value.replace(/<([a-z][a-z0-9]*)[^>]*?(\/?)>/gsi, '');
  // console.log('convertHTMLToText value 1',value);

  // Convert encoding.
  value = value.replace(/&nbsp;/gi, ' ');
  value = value.replace(/&amp;/gi, '&');

  // Replace `<p><br></p>`.
  // value = value.replace(/<p><br><\/p>/gi, '\n');

  // Replace `<br>`.
  value = value.replace(/<br>/gi, '\n');

  // Replace `<div>` (from Chrome).
  value = value.replace(/<div>/gi, '\n');

  // Replace `<p>` (from IE).
  value = value.replace(/<p>/gi, '\n');

  // Remove extra tags.
  value = value.replace(/<(.*?)>/g, '');

  // Trim each line.
  value = value
    .split('\n')
    .map((line = '') => {
      return line.trim();
    })
    .join('\n');

  //Element's innerHTML does not provide the correct spacing when there are line-breaks.
  //(e.g. <div><br></div> provides two spaces when transformed to string)
  //So we need a specific fix for that
  // value = value.replace(/(\n+)/g, ($1) =>  new Array(Math.ceil($1.length/2)).fill('\n',0).join(''));

  // Clean up spaces.
  value = value.replace(/[ ]+/g, ' ');
  value = value.trim();

  // console.log('convertHTMLToText value FINAL',value);

  // Expose string.
  return value;
};

const fixLineBreaks = (element: CustomInputElement): string => {
  let value: string = '';
  if (
    window.location.hostname !== 'mail.google.com' &&
    element.nodeName === 'DIV' &&
    element.childNodes.length === 1
  ) {
    element = element.firstChild as HTMLInputElement;
  }

  for (const child of element.childNodes) {
    const imgElement = findElement(child, 'IMG');
    if (imgElement && child.textContent === '\uFEFF') {
      value += child.textContent + '\n\n\n';
    } else if (imgElement || child.textContent === '\uFEFF') {
      value += child.textContent + '\n\n';
    } else {
      value += child.textContent + '\n';
    }
  }
  return value;
};

const findElement = (node: Node, element: string): boolean => {
  if (node.nodeName === element) {
    return true;
  }
  for (const child of node.childNodes) {
    if (findElement(child, element)) {
      return true;
    }
  }
  return false;
};

const convertTextToHTML = (str: string = ''): string => {
  // Ensure string.
  let value: string = String(str);

  // Convert to string with HTML tags
  const newValue: string = value
    .split('\n')
    .reduce(
      (acc: string, item: string, index: number) =>
        index === 0
          ? item
          : item === ''
          ? `${acc}<div><br></div>`
          : `${acc}<div>${item}</div>`,
      ''
    );

  return newValue;
};

const nodeExistsInDOM = (node: Node): boolean => document.body.contains(node);

const textIsLight = (color: any) => {
  const [r, g, b] = chroma(color).rgb();
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  // Using the HSP value, determine whether the color is light or dark
  return hsp > 127.5 ? true : false;
};

export {
  isObjectEmpty,
  isFunction,
  isInputElement,
  isTextArea,
  isInputText,
  convertHTMLToText,
  convertTextToHTML,
  fixLineBreaks,
  nodeExistsInDOM,
  textIsLight,
};
