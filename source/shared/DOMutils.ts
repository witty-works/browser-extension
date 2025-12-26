import chroma from 'chroma-js';
import { BaseUrls } from './constants';
import { getDomainWithoutSubdomain } from './utils';

export const isTextArea = (
  element: Element
): element is HTMLTextAreaElement => {
  return (
    element instanceof HTMLTextAreaElement || findElement(element, 'TEXTAREA')
  );
};

export const isInShadowDOM = (element: Element) => {
  return element.getRootNode() instanceof ShadowRoot;
};

export const isInputText = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'text';

export const isGoogleDocs = (): boolean => {
  return window.location.href.includes('docs.google.com/document');
};

export const isGmail = (): boolean => {
  return window.location.hostname === 'mail.google.com';
};

export const isAemRte = (element: Element): boolean => {
  const CQrteElement = element?.closest('#CQrte');
  return !!CQrteElement;
};

export const isGoogleSearch = (): boolean => {
  return window.location.hostname === 'www.google.com';
};

export const isHubspot = (): boolean => {
  return window.location.hostname.includes('hubspot');
};

export const isChromeWebstore = (url: string): boolean => {
  return url.includes('google.com') && url.includes('webstore');
};

//can be removed when powerpoint works
export const isMicrosoftOnline = (windowUrl: string): boolean => {
  return (
    windowUrl.includes('onedrive.live.com') ||
    isMicrosoftOnlineWord(windowUrl) ||
    isOutlook(windowUrl) ||
    isMicrosoftOnlineExcel(windowUrl) ||
    isMicrosoftOnlinePowerPoint(windowUrl)
  );
};

export const isMicrosoftOnlineSharepoint = (): boolean => {
  return window.location.hostname.includes('sharepoint.com');
};

export const isMicrosoftOnlineExcel = (windowUrl: string): boolean => {
  const triggerWords = ['chc-excel', '.xlsx'];
  return triggerWords.some((word) => windowUrl.includes(word));
};

export const isMicrosoftOnlinePowerPoint = (windowUrl: string): boolean => {
  const triggerWords = ['chc-powerpoint', '.pptx'];
  return triggerWords.some((word) => windowUrl.includes(word));
};

export const isMicrosoftOnlineWord = (windowUrl: string): boolean => {
  const triggerWords = ['chc-word-edit', 'wordeditorframe', '.docx'];
  return triggerWords.some((word) => windowUrl.includes(word));
};

export const isOffice = (): boolean => {
  return window.location.hostname.includes('office.com');
};

export const isOutlook = (windowUrl?: string): boolean => {
  if (windowUrl) {
    return windowUrl.includes('outlook.office365.com');
  }

  if (window) {
    return window.location.hostname.includes('outlook.office365.com');
  }

  return false;
};

export const isWittyEditor = (): boolean => {
  const dashboardBaseUrls = Object.values(BaseUrls).map(
    (baseUrl) => baseUrl.dashboard
  );
  const isDashboard = dashboardBaseUrls
    .map((url) => window.location.href.includes(url))
    .reduce((acc, curr) => {
      return acc || curr;
    }, false);
  return window.location.href.includes('editor') && isDashboard;
};

export const isTrello = (): boolean => {
  return window.location.hostname.includes('trello');
};

export const isGoogleSheets = (): boolean => {
  return window.location.href.includes('docs.google.com/spreadsheets');
};

export const isNotion = (): boolean => {
  return window.location.hostname === 'www.notion.so';
};

export const isCkEditor = (element: Element): boolean => {
  const ckEditor = element?.closest('.ck-content');
  return !!ckEditor;
};

export const isTinyMceEditor = (element: Element): boolean => {
  const tinymceEditor = element?.closest('#tinymce'); //might have to find a broader condition
  return !!tinymceEditor;
};

export const isBambooHr = (): boolean => {
  return window.location.hostname.includes('bamboohr');
};

export const isModX = (): boolean => {
  return window.location.hostname.includes('modx');
};

export const isFroalaEditor = (element: Element): boolean => {
  const foralaEditor =
    element?.closest('.fr-element') || element?.closest('.fr-view');
  return !!foralaEditor;
};

export const isRedactorEditor = (element: Element): boolean => {
  const redactorEditor = element?.closest('.redactor_html-editor');
  return !!redactorEditor;
};

export const isRecruitee = (): boolean => {
  return window.location.hostname.includes('recruitee.com');
};

export const isGreenhouse = (): boolean => {
  return window.location.hostname.includes('greenhouse');
};

export const isTypo3 = (): boolean => {
  return window.location.hostname.includes('typo3');
};

export const isLinkedin = (): boolean => {
  return window.location.hostname === 'www.linkedin.com';
};

export const isHTMLElementContentEditable = (element: Element): boolean => {
  const elementAsHtmlElement = element as HTMLElement;
  return elementAsHtmlElement?.contentEditable === 'true';
};

export const isChatGpt = () => {
  return window.location.href.includes('chat.openai.com') ? true : false;
};
//Ignore anything that is not a TextArea, an Input type=text or a contenteditable
export const isInputElement = (element: Element) =>
  isTextArea(element) ||
  // isInputText(element) ||      Temporaly disabled as it could capture passwords
  isHTMLElementContentEditable(element);

export const getZIndex = (element: Element) => {
  return isGoogleDocs() ||
    isBambooHr() ||
    isFroalaEditor(element) ||
    isGmail() ||
    isModX()
    ? 501
    : isRedactorEditor(element) || isRecruitee()
    ? 9999998 //make sure highlights are the second largest (smaller than popover)
    : 'auto';
};

export const requiresRectRecalculation = (element: Element) => {
  const domain = getDomainWithoutSubdomain(window.location.hostname);

  return (
    isTextArea(element) ||
    domain === 'personio.de' ||
    isCkEditor(element) ||
    // isTinyMceEditor(element) ||
    isBambooHr()
  );
};

export const iframePositionRecquired = (element: Element) => {
  // maybe isTypo3() and isGreenhose() conditions can be substituted by elementWithinIframe()
  return isTypo3() || isGreenhouse() || elementWithinIframe(element);
};

export const findElement = (node: Node, element: string): boolean => {
  if (node && node.nodeName === element) {
    return true;
  }
  return false;
};

export const nodeExistsInDOM = (document: Document, node: Node): boolean => {
  if (document?.body?.contains(node)) {
    return true;
  }

  let current = node.getRootNode();
  while (current instanceof ShadowRoot) {
    if (current.host) {
      if (document.body.contains(current.host)) {
        return true;
      }
      current = current.host.getRootNode();
    } else {
      break;
    }
  }

  return false;
};

export const elementIsVisible = (element: Element): boolean => {
  const rect: DOMRect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? true : false;
};

export const elementWithinIframe = (element: Element): boolean => {
  return !!element.ownerDocument.defaultView?.frameElement;
};

export const textIsLight = (color: any) => {
  const [r, g, b] = chroma(color).rgb();
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  // Using the HSP value, determine whether the color is light or dark
  return hsp > 127.5 ? true : false;
};
