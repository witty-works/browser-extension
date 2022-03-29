import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys, WTags } from '../shared/constants';
import ContentScriptApp from './ContentScriptApp';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain } from '../shared/utils';

const log = useLog('ContentScript index');

//Main element to add extra markup
const element = document.createElement('witty-code');
element.setAttribute('extension-id', browser.runtime.id);
document.body.appendChild(element);

const customRender = (enabled: boolean) => {
  if (enabled)
    document.body.appendChild(document.createElement(WTags.WW_POPOVER));
  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector(WTags.WW_CONTAINER)
  );
};

const domain = getDomainWithoutSubdomain(window.location.hostname);
if (!defaultConfig.ACTIVE_SITES.includes(domain)) {
  customRender(false);
} else {
  //get extension enable status
  browser.storage.local
    .get(null)
    .then((result) => {
      if (
        (result[StorageKeys.ENABLE_WITTY_EVERYWHERE] &&
          !result[StorageKeys.DISABLED_SITES].includes(domain)) ||
        defaultConfig.ACTIVE_SITES.includes(domain)
      ) {
        customRender(true);
      } else if (!defaultConfig.ACTIVE_SITES.includes(domain)) {
        customRender(false);
      }
    })
    .catch((error: string) => {
      log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    });
}
//TODO define changes type
const storageChange = (changes: any) => {
  if (!defaultConfig.ACTIVE_SITES.includes(domain)) {
    customRender(false);
  } else {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      switch (item) {
        case StorageKeys.DISABLED_SITES:
          customRender(
            !changes[item].newValue.includes(
              window.location.hostname.replace('www.', '')
            )
          );
          break;
        case StorageKeys.ENABLE_WITTY_EVERYWHERE:
          customRender(changes[item].newValue);
          if (
            changes[item].newValue &&
            !defaultConfig.ACTIVE_SITES.includes(
              window.location.hostname.replace('www.', '')
            )
          ) {
            customRender(false);
          }
          break;
      }
    }
  }
};

browser.storage.onChanged.addListener(storageChange);

export {};
