import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';
import ContentScriptApp from './ContentScriptApp';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';

const log = useLog('ContentScript index');

//Main element to add extra markup
document.body.appendChild(document.createElement('witty-code'));

const customRender = (enabled: boolean) => {
  ReactDOM.render(
    enabled ? <ContentScriptApp /> : <></>,
    document.querySelector('witty-code')
  );
};

if (
  !defaultConfig.ACTIVE_SITES.includes(
    window.location.hostname.replace('www.', '')
  )
) {
  customRender(false);
} else {
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
}

//TODO define changes type
const storageChange = (changes: any) => {
  if (
    !defaultConfig.ACTIVE_SITES.includes(
      window.location.hostname.replace('www.', '')
    )
  ) {
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
      }
    }
  }
};

browser.storage.onChanged.addListener(storageChange);

export {};
