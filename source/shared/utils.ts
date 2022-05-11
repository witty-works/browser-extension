import chroma from 'chroma-js';
import { browser } from 'webextension-polyfill-ts';

const isObjectEmpty = (obj: object) =>
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

const isFunction = (functionToCheck: Function) =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';

const isTextArea = (element: Element): element is HTMLTextAreaElement =>
  element instanceof HTMLTextAreaElement;

const isInputText = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'text';

const isHTMLElementContentEditable = (
  element: Element
): element is HTMLElement =>
  element instanceof HTMLElement && element.isContentEditable;

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

const nodeExistsInDOM = (node: Node): boolean => document.body.contains(node);

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

const storeInLocalStorage = (key: string, value: any) => {
  browser.storage.local
    .set({ [key]: value })
    .then(() => {
      //TODO bug, some values are not pronted correctly (for example arrays)
      const wittyVersion = browser.runtime.getManifest().version;
      const componentName = 'Utils';
      const message = `Witty ${key} *${
        typeof value === 'object' ? Object.keys(value) : value
      }* correctly saved`;
      const data = typeof value === 'object' ? Object.keys(value) : value;

      console.log(
        `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
        `color: #55B8E9`,
        `color: #5fca7d`,
        `color: #000`,
        data
      );
    })
    .catch((error: string) => {
      const wittyVersion = browser.runtime.getManifest().version;
      const componentName = 'Utils';
      const message = `onBrowserStorage Error: ${error}`;

      console.log(
        `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
        `color: #55B8E9`,
        `color: #5fca7d`,
        `color: #f00`
      );
    });
};

const getDomainWithoutSubdomain = (url: string) => {
  const urlParts = new URL(url).hostname.split('.');
  return urlParts
    .slice(0)
    .slice(-(urlParts.length === 4 ? 3 : 2))
    .join('.');
};

export {
  isObjectEmpty,
  isFunction,
  isInputElement,
  isTextArea,
  isInputText,
  nodeExistsInDOM,
  elementIsVisible,
  textIsLight,
  storeInLocalStorage,
  getDomainWithoutSubdomain,
};
