import React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys, WTags } from '../shared/constants';
import { isInputText, isTextArea } from '../shared/DOMutils';
import { CustomInputElement, IAuthResponse } from '../shared/types';
import {
  getDomainWithoutSubdomain,
  storeInLocalStorage,
} from '../shared/utils';
import ContentScriptApp, { getActiveDocument } from './ContentScriptApp';
import { createUrl } from '../shared/ApiServices/requests';
import { sendErrorToSentry } from '../shared/errorUtils';

export const updateConfig = (response: IAuthResponse) => {
  response.organization_id &&
    storeInLocalStorage(StorageKeys.ORGANIZATION_ID, response.organization_id);
  response.id && storeInLocalStorage(StorageKeys.USER_ID, response.id);

  response.domains &&
    storeInLocalStorage(StorageKeys.DOMAINS, response.domains.list);

  response.plan && storeInLocalStorage(StorageKeys.PLAN, response.plan);

  response.organization_domains &&
    storeInLocalStorage(
      StorageKeys.ORGANIZATION_DOMAINS,
      response.organization_domains
    );
  response.config_hash &&
    storeInLocalStorage(StorageKeys.CONFIG_HASH, response.config_hash);

  response.organization_config_hash &&
    storeInLocalStorage(
      StorageKeys.ORGANIZATION_CONFIG_HASH,
      response.organization_config_hash
    );

  response.organization_name &&
    storeInLocalStorage(StorageKeys.TEAM_NAME, response.organization_name);
  Object.keys(response.config).forEach((key) => {
    switch (key) {
      case 'gendered_roles_format':
        storeInLocalStorage(
          StorageKeys.GENDERED_ROLES_FORMAT,
          response.config[key]
        );
        break;
      case 'german_gender_ending':
        storeInLocalStorage(
          StorageKeys.GERMAN_GENDER_ENDING,
          response.config[key]
        );
        break;
      case 'inclusive':
        response.config[key].status == 'force' &&
          storeInLocalStorage(StorageKeys.INCLUSIVE, response.config[key]);
        break;
      case 'maximum_importance':
        storeInLocalStorage(
          StorageKeys.MAXIMUM_IMPORTANCE,
          response.config[key]
        );
        break;
      case 'orthography':
        response.config[key].status == 'force' &&
          storeInLocalStorage(StorageKeys.ORTHOGRAPHY, response.config[key]);
        break;
      case 'preferred_variants':
        storeInLocalStorage(
          StorageKeys.PREFERRED_VARIANTS,
          response.config[key]
        );
        break;
      case 'show_inspiration_alternatives':
        storeInLocalStorage(
          StorageKeys.SHOW_INSPIRATION_ALTERNATIVES,
          response.config[key]
        );
        break;
      case 'singular_they':
        storeInLocalStorage(StorageKeys.SINGULAR_THEY, response.config[key]);
        break;
      case 'style':
        response.config[key].status == 'force' &&
          storeInLocalStorage(StorageKeys.STYLE, response.config[key]);
        break;
    }
  });
};

export const getInputText = (element: CustomInputElement) =>
  isTextArea(element) || isInputText(element)
    ? element.value
    : element.innerText.replaceAll(/^\n+/g, '').replaceAll(/\n{2,}/g, '\n');

export const customRender = (enabled: boolean) => {
  if (!document.querySelector(WTags.WW_POPOVER)) {
    const element = document.createElement(WTags.WW_POPOVER);
    document.body.appendChild(element);
  }

  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector(WTags.WW_POPOVER)
  );

  //if more than one container is found, remove all of except the first one. If witty disabled, remove all.
  const containers = getActiveDocument().querySelectorAll(WTags.WW_CONTAINER);
  if (!containers) return;

  for (let i = enabled ? 1 : 0; i < containers.length; i++) {
    containers[i].remove();
  }
};

export const handleDomainsFromDashboard = (newValue: any) => {
  if (
    (newValue.type === 'deny' &&
      newValue.list.includes(
        getDomainWithoutSubdomain(window.location.hostname)
      )) ||
    (newValue.type === 'allow' &&
      !newValue.list.includes(
        getDomainWithoutSubdomain(window.location.hostname)
      ))
  ) {
    customRender(false);
  } else {
    customRender(true);
  }
};

export const getFirstTextDiff = (
  previousTextArray: string[],
  newTextArray: string[]
) => {
  if (!newTextArray) return 0;
  //in what node the diff is
  let node = -1;
  for (let i = 0; i < previousTextArray.length; i++) {
    if (previousTextArray[i] !== newTextArray[i]) {
      node = i;
      break;
    }
  }

  //in what position in the node the diff is
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
};

export const getTextDividedByNodes = (element: CustomInputElement): Node[] => {
  if (isTextArea(element) || isInputText(element)) {
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
      if (node) {
        nodes.push(node);
      }
    }
    return nodes;
  }
};

export const getNodesWithinMaxCharLength = (
  direction: string,
  textDividedByNodes: Node[],
  currentNodeRaw: Node,
  currentNode: number,
  charLengthLeft: number
) => {
  let totalChars = 0;
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
        index:
          direction == 'below'
            ? textDividedByNodes.indexOf(node) +
              textDividedByNodes.indexOf(currentNodeRaw)
            : textDividedByNodes.indexOf(node),
      };
      return newNode;
    })
    .filter((node) => {
      totalChars += node.node.length;
      return (
        totalChars <= (filterCondition ? charLengthLeft : charLengthLeft / 2)
      );
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
        .catch((error) => {
          sendErrorToSentry(error);
        });
    }
  });
};
