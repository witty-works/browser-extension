import * as Sentry from '@sentry/react';
import { browser, Storage } from 'webextension-polyfill-ts';
import {
  BaseUrls,
  StorageKeys,
  wittyVersion,
  exposeWittyIdAllowList,
  DefaultBaseUrlKey,
  WTags,
} from '../shared/constants';
import defaultConfig from '../witty.config.json';
import { getDomainWithoutSubdomain, shouldInjectIntoWindow } from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { customRender, makeAuthRequest } from './utils';
import { setBaseUrls } from '../shared/ApiServices/requests';
import { v4 as uuidv4 } from 'uuid';
import { isMicrosoftOnline } from '../shared/DOMutils';

const handleDomainsFromDashboard = (newValue: string | string[], scriptId: string) => {
  const currentDomain = getDomainWithoutSubdomain(window.location.hostname);
    const currentDomainOnList = newValue?.includes(currentDomain) 
    console.log('currentDomain', currentDomain, currentDomainOnList);
    console.log('customRender', !currentDomainOnList, scriptId)
    customRender(!currentDomainOnList, scriptId);

};

const storageChange = (changes: { [x: string]: Storage.StorageChange | { newValue: any; }; }, scriptId: string) => {
  const currentDomain = getDomainWithoutSubdomain(window.location.hostname);
  const changedItems = Object.keys(changes);

  for (let item of changedItems) {
    if (item === StorageKeys.DOMAINS) {
      handleDomainsFromDashboard(changes[item].newValue, scriptId);
    }

    if (item === StorageKeys.ORGANIZATION_DOMAINS) {
      const orgDomains = changes[item].newValue;
      const isOnOrgDomainList =
        (orgDomains?.type === 'deny' && orgDomains.list?.includes(currentDomain)) ||
        (orgDomains?.type === 'allow' && !orgDomains.list?.includes(currentDomain));
      customRender(!isOnOrgDomainList, scriptId);
    }
  }
};

const initialize = () => {
  const sentryDSN = defaultConfig.SENTRY_DSN;
  const { SENTRY_SAMPLE_RATE: sentrySampleRate, SENTRY_TRACE_RATE: sentryTraceRate } = defaultConfig;
  const domain = getDomainWithoutSubdomain(window.location.hostname);
  const scriptId = uuidv4();

  const wittyIsInstalledElement = document.createElement('witty-is-installed');
  document.body.appendChild(wittyIsInstalledElement);

  if (exposeWittyIdAllowList.includes(domain)) {
    wittyIsInstalledElement.setAttribute('extension-id', browser.runtime.id);
    wittyIsInstalledElement.setAttribute('extension-version', wittyVersion);

    browser.storage.local.get(null).then((result) => {
      const apiEndpoint = result[StorageKeys.API_ENDPOINT_KEY] || DefaultBaseUrlKey;
      setBaseUrls(apiEndpoint);

      if (!result[StorageKeys.ACCESS_TOKEN]) {
        const optionsPageUrl = browser.extension.getURL('options.html');
        const loginUrl = `${BaseUrls[apiEndpoint].dashboard}browser-login?redirect_uri=${optionsPageUrl}`;
        wittyIsInstalledElement.setAttribute('login-url', loginUrl);
      }
    }).catch(sendErrorToSentry);
  }

  browser.storage.local.get(null).then((result) => {
    const orgDomains = result[StorageKeys.ORGANIZATION_DOMAINS];
    const isOnOrgDomainList =
      (orgDomains?.type === 'deny' && orgDomains.list?.includes(domain)) ||
      (orgDomains?.type === 'allow' && !orgDomains.list?.includes(domain));

    const isOnPersonalDomainList = result[StorageKeys.DOMAINS]?.includes(domain);
    const shouldDisable =
      isOnOrgDomainList ||
      isOnPersonalDomainList ||
      defaultConfig.DISABLED_SITES.includes(domain) ||
      isMicrosoftOnline(window.location.href);
    customRender(!shouldDisable, scriptId);
  }).catch(sendErrorToSentry);

  browser.storage.onChanged.addListener((changes) => storageChange(changes, scriptId));
  makeAuthRequest();

  const orphanMessageId = `${browser.runtime.id}orphanCheck`;
  window.dispatchEvent(new Event(orphanMessageId));
  window.addEventListener(orphanMessageId, unregisterOrphan);

  function unregisterOrphan() {
    if (!browser.runtime.id) {
      document.querySelector(`${WTags.WW_POPOVER}-${scriptId}`)?.remove();
      browser.storage.onChanged.removeListener((changes) => storageChange(changes, scriptId));
      window.removeEventListener(orphanMessageId, unregisterOrphan);
    }
  }

  if (sentryDSN) {
    Sentry.init({
      dsn: sentryDSN,
      release: wittyVersion,
      integrations: [new Sentry.BrowserTracing()],
      sampleRate: sentrySampleRate,
      tracesSampleRate: sentryTraceRate,
    });
  }
};

if (shouldInjectIntoWindow(window.self)) {
  initialize();
}
