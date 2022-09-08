import chroma from 'chroma-js';

export const isTextArea = (element: Element): element is HTMLTextAreaElement =>
  element instanceof HTMLTextAreaElement;

export const isInputText = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'text';

export const isGoogleDocs = (): boolean => {
  return window.location.hostname === 'docs.google.com';
};
export const isHTMLElementContentEditable = (
  element: Element
): element is HTMLElement =>
  element instanceof HTMLElement && element.isContentEditable;

//Ignore anything that is not a TextArea, an Input type=text or a contenteditable
export const isInputElement = (element: Element) =>
  isTextArea(element) ||
  // isInputText(element) ||      Temporaly disabled as it could capture passwords
  isHTMLElementContentEditable(element);

export const findElement = (node: Node, element: string): boolean => {
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

export const nodeExistsInDOM = (node: Node): boolean =>
  document.body.contains(node);

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
