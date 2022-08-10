import React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys, WTags } from '../shared/constants';
import { isInputText, isTextArea } from '../shared/DOMutils';
import { CustomInputElement, ResponseConfig } from '../shared/types';
import { storeInLocalStorage } from '../shared/utils';
import ContentScriptApp from './ContentScriptApp';

export const updateConfig = (config: ResponseConfig) => {
  Object.keys(config).forEach((key) => {
    switch (key) {
      case 'gendered_roles_format':
        storeInLocalStorage(StorageKeys.GENDERED_ROLES_FORMAT, config[key]);
        break;
      case 'german_gender_ending':
        storeInLocalStorage(StorageKeys.GERMAN_GENDER_ENDING, config[key]);
        break;
      case 'inclusive':
        storeInLocalStorage(StorageKeys.INCLUSIVE, config[key]);
        break;
      case 'maximum_importance':
        storeInLocalStorage(StorageKeys.MAXIMUM_IMPORTANCE, config[key]);
        break;
      case 'orthography':
        storeInLocalStorage(StorageKeys.ORTHOGRAPHY, config[key]);
        break;
      case 'preferred_variants':
        storeInLocalStorage(StorageKeys.PREFERRED_VARIANTS, config[key]);
        break;
      case 'show_inspiration_alternatives':
        storeInLocalStorage(
          StorageKeys.SHOW_INSPIRATION_ALTERNATIVES,
          config[key]
        );
        break;
      case 'singular_they':
        storeInLocalStorage(StorageKeys.SINGULAR_THEY, config[key]);
        break;
      case 'style':
        storeInLocalStorage(StorageKeys.STYLE, config[key]);
        break;
    }
  });
};

export const updateDomains = (domains: object, organizationDomains: object) => {
  domains && storeInLocalStorage(StorageKeys.DOMAINS, domains);
  organizationDomains &&
    storeInLocalStorage(StorageKeys.ORGANIZATION_DOMAINS, organizationDomains);
};

export const getInputText = (element: CustomInputElement) =>
  isTextArea(element) || isInputText(element)
    ? element.value
    : element.innerText.replaceAll(/^\n+/g, '').replaceAll(/\n{2,}/g, '\n');

export const customRender = (enabled: boolean) => {
  if (!document.querySelector(WTags.WW_POPOVER)) {
    const element = document.createElement(WTags.WW_POPOVER);
    element.setAttribute('extension-id', browser.runtime.id);
    document.body.appendChild(element);
  }

  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector(WTags.WW_POPOVER)
  );

  //if more than one container is found, remove all of except the first one. If witty disabled, remove all.
  const containers = document.querySelectorAll(WTags.WW_CONTAINER);
  if (!containers) return;

  for (let i = enabled ? 1 : 0; i < containers.length; i++) {
    containers[i].remove();
  }
};
