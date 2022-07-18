import * as React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys, WTags } from '../shared/constants';
import ContentScriptApp from './ContentScriptApp';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';

const log = useLog('ContentScript index');

document.body.appendChild(document.createElement('witty-is-installed'));
const wittyIsInstalledElement = document.querySelector('witty-is-installed');
wittyIsInstalledElement &&
  wittyIsInstalledElement.setAttribute('extension-id', browser.runtime.id);

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
  if (!containers) return;

  for (let i = enabled ? 1 : 0; i < containers.length; i++) {
    containers[i].remove();
  }
};

const domain = getDomainWithoutSubdomain(window.location.hostname);
browser.storage.local
  .get(null)
  .then((result) => {
    if (
      (result[StorageKeys.DISABLED_SITES] &&
        result[StorageKeys.DISABLED_SITES].includes(domain)) ||
      (defaultConfig.ACTIVE_SITES &&
        !defaultConfig.ACTIVE_SITES.includes(domain) &&
        !result[StorageKeys.ENABLE_WITTY_EVERYWHERE])
    ) {
      customRender(false);
    } else {
      customRender(true);
    }
  })
  .catch((error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  });

//TODO define changes type
const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);
  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.ENABLE_WITTY_EVERYWHERE:
        if (
          (StorageKeys.DISABLED_SITES &&
            StorageKeys.DISABLED_SITES.includes(
              window.location.hostname.replace('www.', '')
            )) ||
          (defaultConfig.ACTIVE_SITES &&
            !defaultConfig.ACTIVE_SITES.includes(
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

Sentry.init({
  dsn: 'https://41a158eff71044a3ad021f381e0f0349@o512991.ingest.sentry.io/6223342',
  release: 'witty@' + browser.runtime.getManifest().version,
  integrations: [new BrowserTracing()],
  sampleRate: 0.1,
  tracesSampleRate: 0.00001,
});

export {};
