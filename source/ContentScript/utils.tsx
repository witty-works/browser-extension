import React from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { BaseUrls, StorageKeys, WTags } from '../shared/constants';
import { isGoogleDocs, isInputText, isMicrosoftOnlineWord, isTextArea } from '../shared/DOMutils';
import { CustomInputElement, IAuthResponse, INodes } from '../shared/types';
import { storeInLocalStorage } from '../shared/utils';
import ContentScriptApp, { getActiveDocument } from './ContentScriptApp';
import { createUrl } from '../shared/ApiServices/requests';
import { sendErrorToSentry } from '../shared/errorUtils';

export const updateConfig = (response: IAuthResponse, force: boolean = false) => {
  browser.storage.local
      .get(null)
      .then((result) => {

        if (
          response?.config_hash ===
          result[StorageKeys.CONFIG_HASH] &&
          response?.organization_config_hash ===
          result[StorageKeys.ORGANIZATION_CONFIG_HASH]
        ) {
          if (!force) {
            return; // config did not change
          }
          // config hash did not change, but we want to force update
        }
        storeInLocalStorage(StorageKeys.ORGANIZATION_ID, response?.organization_id);
        storeInLocalStorage(StorageKeys.USER_ID, response?.id);
        storeInLocalStorage(StorageKeys.DOMAINS, response?.domains.list); //type not relevant here -> always 'deny'
        storeInLocalStorage(StorageKeys.PLAN, response?.plan);
        storeInLocalStorage(
          StorageKeys.ORGANIZATION_DOMAINS,
          response?.organization_domains
        );
        storeInLocalStorage(StorageKeys.CONFIG_HASH, response?.config_hash);
        storeInLocalStorage(
          StorageKeys.ORGANIZATION_CONFIG_HASH,
          response?.organization_config_hash
        );
        storeInLocalStorage(StorageKeys.TEAM_NAME, response?.organization_name);
        if (response?.organization_config?.categories) {
          storeInLocalStorage(
            StorageKeys.ORTHOGRAPHY,
            response.organization_config.categories.orthography
          );
        }
        }
    ).catch((error) => {
      sendErrorToSentry(error);
    }
  ); 
};

export const getInputText = (element: CustomInputElement | any) => {
  if (isGoogleDocs()) {
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
    return element.innerText
      .replaceAll(/^\n+/g, '')
      .replaceAll(/\n{2,}/g, '\n');
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

  let scriptPopoverElement = body?.querySelector(`${WTags.WW_POPOVER}-${scriptId}`);
  if (!scriptPopoverElement) {
    scriptPopoverElement = document.createElement(`${WTags.WW_POPOVER}-${scriptId}`);
    body?.appendChild(scriptPopoverElement);
  }

  if (scriptPopoverElement) {
    const root = createRoot(scriptPopoverElement);
    root.render(enabled ? <ContentScriptApp /> : <></>);
  }

  // Remove all extra WW_CONTAINER elements if witty is disabled or more than one is found
  const containers = getActiveDocument().querySelectorAll(WTags.WW_CONTAINER);
  if (containers) {
    for (let i = enabled ? 1 : 0; i < containers.length; i++) {
      containers[i].remove();
    }
  }
};

export const getFirstTextDiff = (
  element: CustomInputElement,
  previousTextArray: string[] | string,
  newTextArray: string[] | string
) => {
  const defaultReturnValue = { node: 0, position: 0 };
  if (!newTextArray) return defaultReturnValue;

  if (isTextArea(element) || isMicrosoftOnlineWord(window.location.href)) {
    let i = 0;
    if (!previousTextArray || !newTextArray) return defaultReturnValue;
    while (
      i < previousTextArray.length &&
      i < newTextArray.length &&
      previousTextArray[i] == newTextArray[i]
    ) {
      i++;
    }
    return { node: 0, position: i };
  } else {
    let node = -1;
    for (let i = 0; i < previousTextArray.length; i++) {
      if (previousTextArray[i] !== newTextArray[i]) {
        node = i;
        break;
      }
    }
    let position = 0;
    const previousText = previousTextArray[node];
    const nextText = newTextArray[node];
    if (!previousText || !nextText) return defaultReturnValue;
    while (
      position < previousText.length &&
      position < nextText.length &&
      previousText[position] == nextText[position]
    ) {
      position++;
    }

    return { node, position };
  }
};

export const getTextDividedByNodes = (element: CustomInputElement): Node[] => {
  if (isGoogleDocs()) {
    const clone = document.querySelector('ww-clone');
    let divs = [] as Node[];
    if (clone?.firstChild) {
      for (let i = 0; i < clone.firstChild.childNodes.length; i++) {
        const divElement = clone.firstChild.childNodes[i];
        divs.push(divElement);
      }
    }
    return divs;
  } else if (isTextArea(element) || isInputText(element)) {
    return [element];
  } else {
    const elementEvaluation = getActiveDocument().evaluate(
      './/text()',
      element,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    const nodes = [] as Node[];
    for (let i = 0; i < elementEvaluation.snapshotLength; i++) {
      const node = elementEvaluation.snapshotItem(i);
      node && nodes.push(node);
    }
    return nodes;
  }
};

export const makeAuthRequest = () => {
  browser.storage.local.get(null).then((result) => {
    if (
      result[StorageKeys.ACCESS_TOKEN] &&
      result[StorageKeys.API_ENDPOINT_KEY]
    ) {
      const config = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result[StorageKeys.ACCESS_TOKEN]}`,
        },
      };

      fetch(
        createUrl(
          BaseUrls[result[StorageKeys.API_ENDPOINT_KEY]].api,
          'v2.0/auth'
        ),
        config
      )
        .then(async (response) => {
          if (response.ok) {
            const json = await response.json();
            updateConfig(json, true);
          }
        })
    }
  }).catch((error) => {
    sendErrorToSentry(error);
  });
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
}

export const shouldReturnEarly = (prevNodes: INodes[] | null, currentNodes: Node[] | null): boolean => {
  if (!prevNodes || !currentNodes || prevNodes.length !== currentNodes.length) {
    return false;
  }
  return prevNodes.every((node, index) => areNodesEqual(node, currentNodes[index]));
}

export const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
};
