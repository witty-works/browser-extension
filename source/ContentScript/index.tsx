import * as Sentry from '@sentry/react';
import { browser } from 'webextension-polyfill-ts';
import {
  BaseUrls,
  StorageKeys,
  wittyVersion,
  exposeWittyIdAllowList,
  DefaultBaseUrlKey, WTags,
} from '../shared/constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';
import {getDomainWithoutSubdomain, shouldInjectIntoWindow} from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import {
  customRender,
  handleDomainsFromDashboard,
  makeAuthRequest,
} from './utils';
import { setBaseUrls } from '../shared/ApiServices/requests';
import ReactDOM from "react-dom";
import { v4 as uuidv4 } from 'uuid';
import { isMicrosoftOnline } from '../shared/DOMutils';

const initialize = () => {
  const sentryDSN = defaultConfig.SENTRY_DSN;
  const sentrySampleRate = defaultConfig.SENTRY_SAMPLE_RATE;
  const sentryTraceRate = defaultConfig.SENTRY_TRACE_RATE;
  const log = useLog('ContentScript index');
  const domain = getDomainWithoutSubdomain(window.location.hostname);

const scriptId = uuidv4();

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

          const isOnPersonalDomainList = result[StorageKeys.DOMAINS]?.length !== 0 && result[StorageKeys.DOMAINS]?.includes(domain);
          let parentUrl;
          try {
              parentUrl = window.top?.location.href;
          } catch (error) {
              parentUrl = null;
          }
        if (
            isOnOrgDomainList ||
            isOnPersonalDomainList ||
            defaultConfig.DISABLED_SITES.includes(domain) ||
            isMicrosoftOnline(parentUrl)
        ) {
          customRender(false, scriptId);
        } else {
          customRender(true, scriptId);
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
          handleDomainsFromDashboard(changes[item].newValue, scriptId);
          break;
        case StorageKeys.DOMAINS:
          if (changes[item].newValue.includes(domain)) {
            customRender(false, scriptId);
          } else {
            customRender(true, scriptId);
          }
          break;

        case StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK:
          customRender(
              changes[item].newValue
                  .map((d: string) => d.split('-')[0])
                  .includes(domain)
                  ? false
                  : true,
              scriptId
          );
          break;
      }
    }
  };
  makeAuthRequest();
  browser.storage.onChanged.addListener(storageChange);

  const orphanMessageId = browser.runtime.id + 'orphanCheck';
  window.dispatchEvent(new Event(orphanMessageId));
  window.addEventListener(orphanMessageId, unregisterOrphan);

  function unregisterOrphan() {
    if (browser.runtime.id) {
      return;
    }

    const container = document.querySelector(`${WTags.WW_POPOVER}-${scriptId}`);
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    }

    browser.storage.onChanged.removeListener(storageChange);
    window.removeEventListener(orphanMessageId, unregisterOrphan);
    return true;
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
}

if (shouldInjectIntoWindow(window.self)) {
  initialize();
}

export {};
