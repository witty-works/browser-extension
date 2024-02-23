import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys, WTags } from '../shared/constants';
import { isGoogleDocs, isInputText, isMicrosoftOnlineWord, isTextArea } from '../shared/DOMutils';
import { CustomInputElement, IAuthResponse, INodes } from '../shared/types';
import {
  getDomainWithoutSubdomain,
  storeInLocalStorage,
} from '../shared/utils';
import ContentScriptApp, { getActiveDocument } from './ContentScriptApp';
import { createUrl } from '../shared/ApiServices/requests';
import { sendErrorToSentry } from '../shared/errorUtils';


export const updateConfig = (response: IAuthResponse) => {
  storeInLocalStorage(StorageKeys.ORGANIZATION_ID, response?.organization_id);
  storeInLocalStorage(StorageKeys.USER_ID, response?.id);
  storeInLocalStorage(StorageKeys.DOMAINS, response?.domains.list);
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
  Object.keys(response.config).forEach((key) => {
    const keysForPopover = ['orthography'];
    if (
      (keysForPopover.includes(key) &&
        (response.config[key as keyof typeof response.config] as any).status ==
          'force' && (response.config[key as keyof typeof response.config] as any).value) ||
      !keysForPopover.includes(key)
    ) {
      storeInLocalStorage(
        StorageKeys[key.toUpperCase() as keyof typeof StorageKeys],
        response.config[key as keyof typeof response.config] || null
      );
    }
  });
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
  if (enabled) {
    document.documentElement.setAttribute('witty-is-enabled', 'true');
  } else {
    document.documentElement.removeAttribute('witty-is-enabled');
  }

  if (!document.querySelector(WTags.WW_POPOVER)) {
    const element = document.createElement(WTags.WW_POPOVER);
    document.body.appendChild(element);
  }

  if (!document.querySelector(`${WTags.WW_POPOVER}-${scriptId}`)) {
    const element = document.createElement(`${WTags.WW_POPOVER}-${scriptId}`);
    document.body.appendChild(element);
  }

  const container = document.querySelector(`${WTags.WW_POPOVER}-${scriptId}`);

  if (container) {
    const root = createRoot(container); // Create a root for the container
    root.render(enabled ? <ContentScriptApp /> : <></>); // Conditionally render the component
  }

  //if more than one container is found, remove all of except the first one. If witty disabled, remove all.
  const containers = getActiveDocument().querySelectorAll(WTags.WW_CONTAINER);
  if (!containers) return;

  for (let i = enabled ? 1 : 0; i < containers.length; i++) {
    containers[i].remove();
  }
};

export const handleDomainsFromDashboard = (newValue: any, scriptId: string) => {
  if (
    (newValue.type === 'deny' &&
      newValue.list?.includes(
        getDomainWithoutSubdomain(window.location.hostname)
      )) ||
    (newValue.type === 'allow' &&
      !newValue.list?.includes(
        getDomainWithoutSubdomain(window.location.hostname)
      ))
  ) {
    customRender(false, scriptId);
  } else {
    customRender(true, scriptId);
  }
};

export const getFirstTextDiff = (
  element: CustomInputElement,
  previousTextArray: string[] | string,
  newTextArray: string[] | string
) => {
  if (!newTextArray) return 0;

  if (isTextArea(element) || isMicrosoftOnlineWord(window.location.href)) {
    let i = 0;
    if (!previousTextArray || !newTextArray) return 0;
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
    if (!previousText || !nextText) return;
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

export const getNodesWithinMaxCharLength = (
  direction: string,
  textDividedByNodes: Node[],
  currentNode: number,
  charLengthLeft: number
) => {
  let totalChars = 0;
  textDividedByNodes = textDividedByNodes.filter((node) => { //remove empty nodes
    return node?.textContent && node.textContent.length > 0;
  });
  const slice =
    direction == 'below'
      ? textDividedByNodes.slice(currentNode + 1)
      : textDividedByNodes.slice(0, currentNode).reverse();
  const filterCondition =
    direction == 'below'
      ? currentNode == 0
      : currentNode == textDividedByNodes.length - 1;
  const nodesWhithinMaxCharLength = slice
    .map((node) => {
      const newNode = {
        node: node.textContent as string,
        index: textDividedByNodes.indexOf(node),
        rawNode: node,
      };
      return newNode;
    })
    .filter((node) => {
      totalChars += node.node.length;
      return (
        totalChars <= (filterCondition ? charLengthLeft : charLengthLeft / 2)
      );
    }).sort((a, b) => {
      return direction == 'below' ? a.index - b.index : b.index - a.index;
    });
  return nodesWhithinMaxCharLength;
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
            updateConfig(json);
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
      node.parentNode ? (node.parentNode as CustomInputElement) : null
    );
  }
};


const areNodesEqual = (node1: INodes, node2: Node): boolean => {
  return node1.node === node2.textContent;
}

export const shouldReturnEarly = (prevNodes: INodes[] | null, currentNodes: Node[] | null): boolean => {
  if (!prevNodes || !currentNodes || prevNodes.length !== currentNodes.length) {
    return false;
  }
  return prevNodes.every((node, index) => areNodesEqual(node, currentNodes[index]));
}

