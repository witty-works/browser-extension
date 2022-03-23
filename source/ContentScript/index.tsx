import * as React from 'react';
import ReactDOM from 'react-dom';
import ContentScriptApp from './ContentScriptApp';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';
import '../i18n/i18n';

import { useLog, logTypes } from '../shared/customHooks/useLog';

const log = useLog('ContentScript index');

//Main element to add extra markup
document.body.appendChild(document.createElement('witty-code'));

//get extension enable status
browser.storage.local
  .get(StorageKeys.APP_ENABLED)
  .then((result) => {
    if (result[StorageKeys.APP_ENABLED])
      customRender(result[StorageKeys.APP_ENABLED]);
  })
  .catch((error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  });

const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);

  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.APP_ENABLED:
        customRender(changes[item].newValue);
        break;
    }
  }
};

browser.storage.onChanged.addListener(storageChange);

const customRender = (enabled: boolean) => {
  // ReactDOM.render(
  //   enabled ? <ContentScriptApp /> : <></>,
  //   document.querySelector('witty-code')
  // );
  browser.storage.local
    .get(StorageKeys.DOMAIN_DISABLED)
    .then((domainDisabled) => {
      ReactDOM.render(
        enabled && domainDisabled ? <ContentScriptApp /> : <></>,
        document.querySelector('witty-code')
      );
    });
};

export {};
