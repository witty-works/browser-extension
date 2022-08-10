import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys, wittyVersion } from '../shared/constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { customRender, updateConfig, updateDomains } from './InputUtils';
import { createUrl } from '../shared/ApiServices/requests';

const log = useLog('ContentScript index');

document.body.appendChild(document.createElement('witty-is-installed'));
const wittyIsInstalledElement = document.querySelector('witty-is-installed');
wittyIsInstalledElement &&
  wittyIsInstalledElement.setAttribute('extension-id', browser.runtime.id);

const domain = getDomainWithoutSubdomain(window.location.hostname);
browser.storage.local
  .get(null)
  .then((result) => {
    if (result[StorageKeys.ACCESS_TOKEN] && StorageKeys.API_ENDPOINT_KEY) {
      const config = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result[StorageKeys.ACCESS_TOKEN]}`,
        },
      };

      fetch(
        createUrl(
          BaseUrls[result[StorageKeys.API_ENDPOINT_KEY]].api,
          'v2.0/auth'
        ),
        config
      ).then(async (response) => {
        if (response.ok) {
          const json = await response.json();
          updateDomains(json.domains, json.organization_domains);
          updateConfig(json.config);
        }
      });
    }

    if (
      (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
      (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
        !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain))
    ) {
      customRender(false);
    } else if (
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
      case StorageKeys.ORGANIZATION_DOMAINS:
        if (
          (changes[item].newValue.type === 'deny' &&
            changes[item].newValue.list.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            )) ||
          (changes[item].newValue.type === 'allow' &&
            !changes[item].newValue.list.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            ))
        ) {
          customRender(false);
        } else {
          customRender(true);
        }
        break;
    }
  }
};

browser.storage.onChanged.addListener(storageChange);

Sentry.init({
  dsn: 'https://658b8e1fd3954c7fb6acc851dda97a4d@o512991.ingest.sentry.io/6223342',
  release: 'witty@' + wittyVersion,
  integrations: [new BrowserTracing()],
  sampleRate: 0.0,
  tracesSampleRate: 0.001,
});

export {};
