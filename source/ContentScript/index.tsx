import * as React from 'react';
import ReactDOM from 'react-dom';
import ContentScriptApp from './ContentScriptApp';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys, DEV_ENV } from '../shared/constants';

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
    if (DEV_ENV) console.log('onError = ', error);
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
  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector('witty-code')
  );
};

export {};
