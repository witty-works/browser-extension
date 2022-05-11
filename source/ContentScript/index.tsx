import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';
import ContentScriptApp from './ContentScriptApp';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';

const log = useLog('ContentScript index');

//Main element to add extra markup
const element = document.createElement('witty-code');
element.setAttribute('extension-id', browser.runtime.id);
document.body.appendChild(element);

const customRender = (enabled: boolean) => {
  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector('witty-code')
  );
};

browser.storage.local
  .get(null)
  .then((result) => {
    if (
      (result[StorageKeys.ENABLE_WITTY_EVERYWHERE] &&
        !result[StorageKeys.DISABLED_SITES].includes(
          window.location.hostname.replace('www.', '')
        )) ||
      defaultConfig.ACTIVE_SITES.includes(
        window.location.hostname.replace('www.', '')
      )
    ) {
      customRender(true);
    } else if (
      !defaultConfig.ACTIVE_SITES.includes(
        window.location.hostname.replace('www.', '')
      )
    ) {
      customRender(false);
    }
  })
  .catch((error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  });

//TODO define changes type
const storageChange = (changes: any) => {
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
};

browser.storage.onChanged.addListener(storageChange);

export {};
