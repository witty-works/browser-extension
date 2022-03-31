import * as React from 'react';
import ReactDOM from 'react-dom';
import ContentScriptApp from './ContentScriptApp';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';
import '../i18n/i18n';

import { useLog, logTypes } from '../shared/customHooks/useLog';

//Main element to add extra markup
document.body.appendChild(document.createElement('witty-code'));

const log = useLog('ContentScript index');

const onError = (error: string) => {
  log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
};

const customRender = (enabled: boolean) => {
  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector('witty-code')
  );
};
browser.storage.local
  .get(StorageKeys.DISABLED_SITES)
  .then((result) => {
    const disabledSites = result[StorageKeys.DISABLED_SITES] || [];
    const currentDomain = window.location.host.replace('www.', '');
    disabledSites.includes(currentDomain as never)
      ? customRender(false)
      : customRender(true);
  })
  .catch(onError);

const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);
  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.DISABLED_SITES:
        browser.storage.local.get(StorageKeys.DISABLED_SITES).then((result) => {
          const disabledSites = result[StorageKeys.DISABLED_SITES] || [];
          const currentDomain = window.location.host.replace('www.', '');
          disabledSites.includes(currentDomain as never)
            ? customRender(false)
            : customRender(true);
        });
        break;
    }
  }
};

browser.storage.onChanged.addListener(storageChange);

export {};
