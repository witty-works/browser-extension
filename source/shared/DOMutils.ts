import chroma from 'chroma-js';
import { getActiveDocument } from '../ContentScript/ContentScriptApp';

export const isTextArea = (
  element: Element
): element is HTMLTextAreaElement => {
  return (
    element instanceof HTMLTextAreaElement || findElement(element, 'TEXTAREA')
  );
};

export const isInputText = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'text';

export const isGoogleDocs = (): boolean => {
  return window.location.href.includes('docs.google.com/document');
};

export const isGoogleSheets = (): boolean => {
  return window.location.href.includes('docs.google.com/spreadsheets');
};

export const isNotion = (): boolean => {
  return window.location.hostname === 'www.notion.so';
};

export const isCkEditor = (element: Element): boolean => {
  const ckEditor = element.closest('.ck-content');
  return !!ckEditor;
};

export const isTinyMceEditor = (element: Element): boolean => {
  const tinymceEditor = element.closest('#tinymce'); //might have to find a broader condition
  return !!tinymceEditor;
};

export const isBambooHr = (): boolean => {
  return window.location.hostname.split('.').includes('bamboohr');
};
export const isFroalaEditor = (element: Element): boolean => {
  const foralaEditor = element.closest('.fr-element');
  return !!foralaEditor;
};

export const isLinkedInMessage = (): boolean => {
  return (
    !!getActiveDocument().querySelector('.msg-form__contenteditable') &&
    isLinkedin()
  );
};

export const isLinkedin = (): boolean => {
  return window.location.hostname === 'www.linkedin.com';
};

export const isHTMLElementContentEditable = (element: Element): boolean => {
  const elementAsHtmlElement = element as HTMLElement;
  return elementAsHtmlElement.contentEditable === 'true';
};

export const isChatGpt = () => {
  return window.location.href.includes('chat.openai.com') ? true : false;
};
//Ignore anything that is not a TextArea, an Input type=text or a contenteditable
export const isInputElement = (element: Element) =>
  isTextArea(element) ||
  // isInputText(element) ||      Temporaly disabled as it could capture passwords
  isHTMLElementContentEditable(element);

export const findElement = (node: Node, element: string): boolean => {
  if (node.nodeName === element) {
    return true;
  }
  return false;
};

export const nodeExistsInDOM = (node: Node): boolean =>
  getActiveDocument().body.contains(node);

export const elementIsVisible = (element: Element): boolean => {
  const rect: DOMRect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? true : false;
};

export const textIsLight = (color: any) => {
  const [r, g, b] = chroma(color).rgb();
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  // Using the HSP value, determine whether the color is light or dark
  return hsp > 127.5 ? true : false;
};
