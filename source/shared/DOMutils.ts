import chroma from 'chroma-js';
import { getActiveDocument } from '../ContentScript/ContentScriptApp';

const isTextArea = (element: Element): element is HTMLTextAreaElement => {
  return (
    element instanceof HTMLTextAreaElement || findElement(element, 'TEXTAREA')
  );
};

const isInputText = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'text';

const isCkeEditor = (element: Element): boolean => {
  const ckeEditor = element.closest('.ck-content');
  return !!ckeEditor;
};

const isTinyMceEditor = (element: Element): boolean => {
  const tinymceEditor = element.closest('#tinymce'); //might have to find a broader condition
  return !!tinymceEditor;
};

const isHTMLElementContentEditable = (element: Element): boolean => {
  const elementAsHtmlElement = element as HTMLElement;
  return elementAsHtmlElement.contentEditable === 'true';
};

//Ignore anything that is not a TextArea, an Input type=text or a contenteditable
const isInputElement = (element: Element) =>
  isTextArea(element) ||
  // isInputText(element) ||      Temporaly disabled as it could capture passwords
  isHTMLElementContentEditable(element);

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

const nodeExistsInDOM = (node: Node): boolean =>
  getActiveDocument().body.contains(node);

const elementIsVisible = (element: Element): boolean => {
  const rect: DOMRect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? true : false;
};

const textIsLight = (color: any) => {
  const [r, g, b] = chroma(color).rgb();
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  // Using the HSP value, determine whether the color is light or dark
  return hsp > 127.5 ? true : false;
};

export {
  isTextArea,
  isInputText,
  isInputElement,
  nodeExistsInDOM,
  elementIsVisible,
  textIsLight,
  isCkeEditor,
  isTinyMceEditor,
};
