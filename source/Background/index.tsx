import { browser } from 'webextension-polyfill-ts';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

import {
  StorageKeys,
  DEV_ENV,
  WittyIconActive,
  wittyVersion,
} from '../shared/constants';
import {
  addInactiveBadge,
  addLoginBadge,
  addNotificationBadge,
  getBrowserId,
  getDomainWithoutSubdomain,
  isFunction,
  removeBadge,
  updateLabelChrome,
} from '../shared/utils';
import defaultConfig from '../witty.config.json';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { DefaultConfigValue } from '../shared/types';
import { useLog } from '../shared/customHooks/useLog';
import { sendErrorToSentry } from '../shared/errorUtils';

const analytics = useAnalytics();
const log = useLog('Background index');

const onSave = (key: string, value: DefaultConfigValue) => {
  log(
    `Key *${key}* with value *${(typeof value === 'object'
      ? JSON.stringify(value)
      : value
    ).toString()}* saved correctly in local storage`
  );
};

const onError = (error: string) => {
  log(`Local Storage Error: ${error}`);
  sendErrorToSentry(error);
};

Sentry.init({
  dsn: 'https://658b8e1fd3954c7fb6acc851dda97a4d@o512991.ingest.sentry.io/6223342',
  release: 'witty@' + wittyVersion,
  integrations: [new BrowserTracing()],
  sampleRate: 0.0,
  tracesSampleRate: 0.005,
});

const addEventListeners = () => {
  browser.tabs.onCreated.addListener(scanTabsToDetectStatus);
  browser.tabs.onUpdated.addListener(scanTabsToDetectStatus);
  browser.tabs.onActivated.addListener(scanTabsToDetectStatus);
  browser.storage.onChanged.addListener(storageChange);
};

browser.runtime.onInstalled.addListener(function (details: { reason: string }) {
  analytics.extensionInstallationAndUpdateLog(details.reason, true);
  analytics.extensionInstallationAndUpdateLog(details.reason, false);
  browser.browserAction.setIcon(WittyIconActive);
  if (!DEV_ENV)
    browser.runtime.setUninstallURL('https://www.witty.works/goodbye');

  if (details.reason === 'install') {
    //Set default settings
    setSettings();

    //Open the welcome page
    if (!DEV_ENV) {
      browser.tabs.create({
        url: 'https://www.witty.works/welcome',
      });
    }
  }
  if (details.reason === 'update') {
    //Set icon according to the saved settings
    scanTabsToDetectStatus();
  }
});

const setInLocalStorage = (key: string, value: DefaultConfigValue): void => {
  //Check if setting is already defined in the local storage
  //If not, then add it
  browser.storage.local
    .get()
    .then((result) => {
      let savedValue: DefaultConfigValue = result[key];
      const devAppId = result[StorageKeys.APP_ID];
      if (!savedValue || savedValue == devAppId || DEV_ENV) {
        let valueToSave = isFunction(value as Function)
          ? (value as Function)()
          : value;
        browser.storage.local
          .set({ [key]: valueToSave })
          .then(() => onSave(key, valueToSave))
          .catch(onError);
      }
    })
    .catch(onError);
};

const setSettings = () => {
  //Set default settings
  for (let [defaultConfigKey, defaultConfigValue] of Object.entries(
    defaultConfig
  )) {
    if (defaultConfigKey in StorageKeys) {
      const storageKey =
        StorageKeys[defaultConfigKey as keyof typeof StorageKeys];
      setInLocalStorage(storageKey, defaultConfigValue);
    }
  }
  //Set browser id
  setInLocalStorage(StorageKeys.APP_ID, getBrowserId);
};

const scanTabsToDetectStatus = () => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs.length != 0 && tabs[0].url) {
      const domain = getDomainWithoutSubdomain(new URL(tabs[0].url).hostname);
      updateLabelChrome(domain);
    } else if (
      defaultConfig.CHROME_AND_FIREFOX_SITES &&
      defaultConfig.CHROME_AND_FIREFOX_SITES.includes(window.location.protocol)
    ) {
      removeBadge();
    }
  });
};

const storageChange = (changes: { [key: string]: any }) => {
  const changedItems = Object.keys(changes);

  changedItems.forEach((key) => {
    if (key === StorageKeys.ACCESS_TOKEN) {
      if (!changes[key].newValue) {
        addLoginBadge();
      }
    }
    if (key === StorageKeys.ORGANIZATION_DOMAINS) {
      if (
        (changes[key].newValue.type === 'deny' &&
          changes[key].newValue.list.includes(
            getDomainWithoutSubdomain(window.location.hostname)
          )) ||
        (changes[key].newValue.type === 'allow' &&
          !changes[key].newValue.list.includes(
            getDomainWithoutSubdomain(window.location.hostname)
          ))
      ) {
        addInactiveBadge();
      } else {
        removeBadge();
      }
    }
    if (key === StorageKeys.DOMAINS) {
      changes[key].newValue.list.includes(
        getDomainWithoutSubdomain(window.location.hostname)
      )
        ? addInactiveBadge()
        : removeBadge();
    }
    if (key === StorageKeys.NUMBER_OF_NOTIFICATIONS) {
      changes[key].newValue === 0
        ? removeBadge()
        : addNotificationBadge(changes[key].newValue);
    }
  });
};

addEventListeners();
//TODO Remove Listeners
