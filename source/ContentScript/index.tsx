import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { browser } from 'webextension-polyfill-ts';
import {
  BaseUrls,
  StorageKeys,
  wittyVersion,
  exposeWittyIdAllowList,
  DefaultBaseUrlKey,
} from '../shared/constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import {
  customRender,
  handleDomainsFromDashboard,
  makeAuthRequest,
} from './utils';
import { setBaseUrls } from '../shared/ApiServices/requests';

const log = useLog('ContentScript index');
const domain = getDomainWithoutSubdomain(window.location.hostname);

document.body.appendChild(document.createElement('witty-is-installed'));
const wittyIsInstalledElement = document.querySelector('witty-is-installed');
if (exposeWittyIdAllowList.includes(domain)) {
  wittyIsInstalledElement?.setAttribute('extension-id', browser.runtime.id);
  wittyIsInstalledElement?.setAttribute('extension-version', wittyVersion);

  browser.storage.local.get(null).then((result) => {
    setBaseUrls(
      result[StorageKeys.API_ENDPOINT_KEY]
        ? result[StorageKeys.API_ENDPOINT_KEY]
        : DefaultBaseUrlKey
    );
    if (!result[StorageKeys.ACCESS_TOKEN]) {
      const optionsPageUrl = browser.extension.getURL('options.html');
      const urls = result[StorageKeys.API_ENDPOINT_KEY]
        ? result[StorageKeys.API_ENDPOINT_KEY]
        : DefaultBaseUrlKey;

      const url = `${BaseUrls[urls].dashboard}browser-login?redirect_uri=${optionsPageUrl}`;
      wittyIsInstalledElement?.setAttribute('login-url', url);
    }
  });
}

browser.storage.local
  .get(null)
  .then((result) => {
    const isOnOrgDomainList =
      (result[StorageKeys.ORGANIZATION_DOMAINS] &&
        result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
      (result[StorageKeys.ORGANIZATION_DOMAINS] &&
        result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list &&
        !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain));

    const isOnPersonalDomainList = result[StorageKeys.DOMAINS].length !== 0 && result[StorageKeys.DOMAINS]?.includes(domain);
    if (
      isOnOrgDomainList ||
      isOnPersonalDomainList ||
      defaultConfig.DISABLED_SITES.includes(domain)
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
        handleDomainsFromDashboard(changes[item].newValue);
        break;
      case StorageKeys.DOMAINS:
        if (changes[item].newValue.includes(domain)) {
          customRender(false);
        } else {
          customRender(true);
        }
        break;

      case StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK:
        customRender(
          changes[item].newValue
            .map((d: string) => d.split('-')[0])
            .includes(domain)
            ? false
            : true
        );
        break;
    }
  }
};
makeAuthRequest();
browser.storage.onChanged.addListener(storageChange);

Sentry.init({
  dsn: 'https://658b8e1fd3954c7fb6acc851dda97a4d@o512991.ingest.sentry.io/6223342',
  release: 'witty@' + wittyVersion,
  integrations: [new BrowserTracing()],
  sampleRate: 0.0,
  tracesSampleRate: 0.005,
});

export {};
