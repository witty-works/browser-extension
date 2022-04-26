import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';
import ContentScriptApp from './ContentScriptApp';
import { useLog, logTypes } from '../shared/customHooks/useLog';

const log = useLog('ContentScript index');

//Main element to add extra markup
document.body.appendChild(document.createElement('witty-code'));
const element = document.querySelector('witty-code');
element && element.setAttribute('extension-id', browser.runtime.id);

//get extension enable status
browser.storage.local
  .get(StorageKeys.DISABLED_SITES)
  .then((result) => {
    customRender(
      !result[StorageKeys.DISABLED_SITES].includes(
        window.location.hostname.replace('www.', '')
      )
    );
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
    }
  }
};

browser.storage.onChanged.addListener(storageChange);

const customRender = (enabled: boolean) => {
  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector('witty-code')
  );
};

export {};
