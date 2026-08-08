import React from 'react';
import {createRoot} from 'react-dom/client';
import {WTags} from '../shared/constants';
import {isGoogleDocs, isInputText, isTextArea} from '../shared/DOMutils';
import {CustomInputElement, DiffChange, INodes} from '../shared/types';
import ContentScriptApp from './ContentScriptApp';
import {getActiveDocument} from '../shared/activeDocument';
import {diffChars, diffWords, DiffWordsOptionsNonabortable} from 'diff';

export const getInputText = (element: CustomInputElement | any) => {
  if (isGoogleDocs(element)) {
    let text = '';
    if (element.childNodes) {
      for (let i = 0; i < element.childNodes.length; i++) {
        const divElement = element.childNodes[i];
        text += divElement.textContent;
      }
    }
    return text;
  } else if (isTextArea(element) || isInputText(element)) {
    return element.value;
  } else {
    return getNodesWithNewlines(element)
      .map((node) => node.text)
      .join('');
  }
};

export const customRender = (enabled: boolean, scriptId: string) => {
  const doc = document.documentElement;
  const body = document.body;

  if (enabled) {
    doc.setAttribute('witty-is-enabled', 'true');
  } else {
    doc.removeAttribute('witty-is-enabled');
  }

  let popoverElement = body?.querySelector(WTags.WW_POPOVER);
  if (!popoverElement) {
    popoverElement = document.createElement(WTags.WW_POPOVER);
    body?.appendChild(popoverElement);
  }

  let scriptPopoverElement = body?.querySelector(
    `${WTags.WW_POPOVER}-${scriptId}`
  );
  if (!scriptPopoverElement) {
    scriptPopoverElement = document.createElement(
      `${WTags.WW_POPOVER}-${scriptId}`
    );
    body?.appendChild(scriptPopoverElement);
  }

  if (scriptPopoverElement) {
    // If we've previously created a root for this element, unmount it first
    const existingRoot = (scriptPopoverElement as any).__wittyRoot;
    if (existingRoot && typeof existingRoot.unmount === 'function') {
      try {
        existingRoot.unmount();
      } catch (err) {
        // ignore
      }
      try {
        delete (scriptPopoverElement as any).__wittyRoot;
      } catch (err) {
        // ignore
      }
    }

    const root = createRoot(scriptPopoverElement);
    try {
      (scriptPopoverElement as any).__wittyRoot = root;
    } catch (err) {
      // ignore
    }
    root.render(enabled ? <ContentScriptApp /> : <></>);
  }

  // Remove all extra WW_CONTAINER elements if witty is disabled or more than one is found
  const containers = getActiveDocument().querySelectorAll(
    WTags.WW_SHADOW_ROOT_CONTAINER
  );
  if (containers) {
    for (let i = enabled ? 1 : 0; i < containers.length; i++) {
      safeUnmountAndRemove(containers[i] as HTMLElement);
    }
  }
};

export const removeHTMLTags = (htmlString: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const textContent = doc.body.textContent ?? '';
  return textContent.trim();
};

export const safeUnmountAndRemove = (el: HTMLElement | null | undefined) => {
  if (!el) return;
  try {
    const root = (el as any).__wittyRoot;
    if (root && typeof root.unmount === 'function') {
      try {
        root.unmount();
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    // ignore
  }
  try {
    el.remove();
  } catch (err) {
    // ignore
  }
};

export const getFirstTextDiff = (
  oldText: string,
  newText: string
): {
  changedOffset: number;
  originalLength: number;
  newLength: number;
} | null => {
  const diff = diffChars(oldText, newText);

  let changedOffset = 0;
  let originalLength = 0;
  let newLength = 0;
  let index = 0;
  let foundDifference = false;

  for (const part of diff) {
    if (part.added || part.removed) {
      if (!foundDifference) {
        changedOffset = index;
        foundDifference = true;
      }

      if (part.added) {
        newLength += part.count || 0;
      } else if (part.removed) {
        originalLength += part.count || 0;
      }
    } else {
      if (!foundDifference) {
        index += part.count || 0;
      }
    }
  }

  if (originalLength !== newLength) {
    return {changedOffset, originalLength, newLength};
  }

  return null;
};

export const computeDiff = (
  language: string,
  originalSentence: string,
  newSentence: string
) => {
  // diff v9 renamed WordsOptions and split the overloads: the non-abortable
  // one is what returns a definite array rather than `… | undefined`.
  const options: DiffWordsOptionsNonabortable = {
    intlSegmenter: new (Intl as any).Segmenter(language, {
      granularity: 'word',
    }),
  };

  const diffElements: DiffChange[] = diffWords(
    originalSentence,
    newSentence,
    options
  );

  const maxDiffLength = 120;
  const minDiffLength = 50;

  let diffElement: DiffChange;

  let diff = '';
  let tag = '';

  let start = 0;
  let end: number = diffElements.length - 1;

  for (let i = 0; i < diffElements.length; i++) {
    diffElement = diffElements[i];
    if (diffElement.added || diffElement.removed) {
      if (diff === '') {
        start = i;
      } else if (diff.endsWith('</ins>') || diff.endsWith('</del>')) {
        diff += ' ';
      }
      end = i;

      tag = diffElement.added ? 'ins' : 'del';
      if (diffElement.value !== 'undefined') {
        diff += `<${tag}>${diffElement.value}</${tag}>`;
      }
    } else if (diff !== '' && i < diffElements.length - 1) {
      diff += diffElement.value;
    }
  }

  const strippedString = removeHTMLTags(diff);
  let stringLengthDiff = maxDiffLength - strippedString.length;
  if (stringLengthDiff > 0) {
    let value = '';
    if (start > 0) {
      value = diffElements[0].value.substring(
        Math.max(
          0,
          diffElements[0].value.length -
            Math.min(minDiffLength, stringLengthDiff)
        ),
        diffElements[0].value.length
      );

      if (value != diffElements[0].value) {
        value = value.slice(value.indexOf(' '));
        value = '...' + value;
      }

      diff = value + diff;
    }

    stringLengthDiff -= value.length;
    if (end < diffElements.length - 1 && stringLengthDiff) {
      let value = diffElements[diffElements.length - 1].value.substring(
        0,
        Math.min(minDiffLength, stringLengthDiff)
      );
      if (value != diffElements[diffElements.length - 1].value) {
        value = value.substring(0, value.lastIndexOf(' '));
        value = value + '...';
      }

      diff = diff + value;
    }
  }

  return diff;
};

export const getNodesWithNewlines = (
  element: HTMLElement
): {node: Node; text: string}[] => {
  const nodesWithNewlines: {node: Node; text: string}[] = [];
  let lastWasBlock = false; // Tracks whether the last processed element was a block

  function walk(node: Node, isRoot = false): void {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) {
        // Append newline if the last node was a block
        if (lastWasBlock) {
          const lastNode = nodesWithNewlines[nodesWithNewlines.length - 1];
          if (lastNode) {
            nodesWithNewlines.push({
              node: document.createTextNode('\n'),
              text: '\n',
            });
          }
        }

        // Add the current text node
        nodesWithNewlines.push({
          node,
          text: node.textContent.replace(/\ufeff/g, ''),
        });
        lastWasBlock = false;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      // Handle <br> elements explicitly
      if (element.tagName === 'BR') {
        nodesWithNewlines.push({
          node: document.createTextNode('\n'),
          text: '\n',
        });
        lastWasBlock = false;
        return;
      }

      // Before processing children, check if it's a block-level element
      const isBlockElement =
        window.getComputedStyle(element).display === 'block' ||
        element.tagName === 'DIV';

      // Add newline if transitioning to a block-level element
      if (isBlockElement && !isRoot && !lastWasBlock) {
        const lastNode = nodesWithNewlines[nodesWithNewlines.length - 1];
        if (lastNode) {
          nodesWithNewlines.push({
            node: document.createTextNode('\n'),
            text: '\n',
          });
        }
      }

      // Process child nodes recursively
      element.childNodes.forEach((child) => walk(child));

      // Mark block-level elements
      lastWasBlock = isBlockElement;
    }
  }

  // Start recursion
  walk(element, true);
  return nodesWithNewlines;
};

export const getTextDividedByNodes = (
  element: CustomInputElement
): {node: Node; text: string}[] => {
  if (isGoogleDocs(element)) {
    const clone = findCloneContainer();
    const divs = [] as Node[];
    if (clone?.firstChild) {
      for (let i = 0; i < clone.firstChild.childNodes.length; i++) {
        const divElement = clone.firstChild.childNodes[i];
        divs.push(divElement);
      }
    }
    return divs.map((node) => {
      return {node, text: node.textContent || ''};
    });
  } else if (isTextArea(element) || isInputText(element)) {
    return [{node: element, text: element.value}];
  } else {
    return getNodesWithNewlines(element);
  }
};

export const findCloneContainer = (): Element | null => {
  const shadowRootContainer = document.querySelector(
    WTags.WW_SHADOW_ROOT_CONTAINER
  );
  if (!shadowRootContainer) {
    return null;
  }

  return shadowRootContainer.shadowRoot
    ? shadowRootContainer.shadowRoot.querySelector(WTags.WW_CLONE)
    : null;
};

export const getScrollParent = (
  node: CustomInputElement | null
): CustomInputElement | null => {
  if (node == null) {
    return null;
  }

  if (node.scrollHeight > node.clientHeight) {
    return node;
  } else {
    return getScrollParent(
      node?.parentNode ? (node.parentNode as CustomInputElement) : null
    );
  }
};

const areNodesEqual = (node1: INodes, node2: Node): boolean => {
  const isNodeTextArea = node2 instanceof HTMLElement && isTextArea(node2);
  if (isNodeTextArea) {
    return node1.node === (node2 as HTMLTextAreaElement).value;
  }
  return node1.node === node2.textContent;
};

export const shouldReturnEarly = (
  prevNodes: INodes[] | null,
  currentNodes: Node[] | null
): boolean => {
  if (!prevNodes || !currentNodes || prevNodes.length !== currentNodes.length) {
    return false;
  }
  return prevNodes.every((node, index) =>
    areNodesEqual(node, currentNodes[index])
  );
};

export {hashString} from '../shared/hash';
