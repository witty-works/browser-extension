import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys, wittyVersion } from '../shared/constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import {
  customRender,
  handleOrganizationDomains,
  updateConfig,
} from './InputUtils';
import { createUrl } from '../shared/ApiServices/requests';

const log = useLog('ContentScript index');

document.body.appendChild(document.createElement('witty-is-installed'));
const wittyIsInstalledElement = document.querySelector('witty-is-installed');
wittyIsInstalledElement &&
  wittyIsInstalledElement.setAttribute('extension-id', browser.runtime.id);

const domain = getDomainWithoutSubdomain(window.location.hostname);

const handleDomainToUpdate = () => {
  browser.storage.local.get(null).then((result) => {
    if (
      result[StorageKeys.DOMAIN_TO_UPDATE] &&
      result[StorageKeys.ACCESS_TOKEN] &&
      StorageKeys.API_ENDPOINT_KEY
    ) {
      fetch(
        createUrl(
          BaseUrls[result[StorageKeys.API_ENDPOINT_KEY]].dashboard,
          `api/user/language/domains?` +
            new URLSearchParams({
              domain: result[StorageKeys.DOMAIN_TO_UPDATE].domain,
            })
        ),
        {
          method: result[StorageKeys.DOMAIN_TO_UPDATE].enabled
            ? 'DELETE'
            : 'PUT',
          headers: {
            Authorization: `Bearer ${result[StorageKeys.ACCESS_TOKEN]}`,
          },
        }
      ).then(async (response) => {
        if (response.ok) {
          await browser.storage.local.set({
            [StorageKeys.DOMAIN_TO_UPDATE]: null,
          });
        }
      });
    }
  });
};

browser.storage.local.get(null).then((result) => {
  if (
    result[StorageKeys.ACCESS_TOKEN] &&
    result[StorageKeys.API_ENDPOINT_KEY]
  ) {
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
        updateConfig(json);
      }
    });
  }
});

browser.storage.local
  .get(null)
  .then((result) => {
    if (
      (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
      (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
        !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain))
    ) {
      customRender(false);
    } else if (
      defaultConfig.DISABLED_SITES.includes(domain) ||
      result[StorageKeys.DOMAINS_DISABLED_LOCALLY].includes(domain) ||
      !result[StorageKeys.ACCESS_TOKEN]
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

const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);
  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.ORGANIZATION_DOMAINS:
        handleOrganizationDomains(changes[item].newValue);
        break;
      case StorageKeys.DOMAIN_TO_UPDATE:
        handleDomainToUpdate();
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
