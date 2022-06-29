import * as React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys, WTags } from '../shared/constants';
import ContentScriptApp from './ContentScriptApp';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain } from '../shared/utils';

const log = useLog('ContentScript index');

const customRender = (enabled: boolean) => {
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
  for (let i = enabled ? 1 : 0; i < containers.length; i++) {
    containers[i].remove();
  }
};

const domain = getDomainWithoutSubdomain(window.location.hostname);
browser.storage.local
  .get(null)
  .then((result) => {
    if (
      result[StorageKeys.DISABLED_SITES].includes(domain) ||
      (!defaultConfig.ACTIVE_SITES.includes(domain) &&
        !result[StorageKeys.ENABLE_WITTY_EVERYWHERE])
    ) {
      customRender(false);
    } else {
      customRender(true);
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
      case StorageKeys.ENABLE_WITTY_EVERYWHERE:
        if (
          StorageKeys.DISABLED_SITES.includes(
            window.location.hostname.replace('www.', '')
          ) ||
          (!defaultConfig.ACTIVE_SITES.includes(
            window.location.hostname.replace('www.', '')
          ) &&
            !changes[item].newValue)
        ) {
          customRender(false);
        } else {
          customRender(true);
        }
        break;
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

export {};
