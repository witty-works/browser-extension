import { browser } from 'webextension-polyfill-ts';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

import {
  StorageKeys,
  DEV_ENV,
  WittyIconActive,
  WittyIconInactive,
} from '../shared/constants';
import { getDomainWithoutSubdomain, isFunction } from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import defaultConfig from '../witty.config.json';
import { useLog } from '../shared/customHooks/useLog';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';

const analytics = useAnalytics();
const log = useLog('Background index');
const devAppId = 'DEV_APP_ID';
type DefaultConfigValue =
  | string
  | boolean
  | number
  | string[]
  | object
  | (() => string);

Sentry.init({
  dsn: 'https://41a158eff71044a3ad021f381e0f0349@o512991.ingest.sentry.io/6223342',
  release: 'witty@' + browser.runtime.getManifest().version,
  integrations: [new BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%, recomended to djusting this value in production.
  tracesSampleRate: 1.0,
});

browser.runtime.onInstalled.addListener(function (details: { reason: string }) {
  if (!DEV_ENV)
    browser.runtime.setUninstallURL('https://www.witty.works/goodbye');

  if (details.reason === 'install') {
    //Set default settings
    setSettings();

    //Set icon to active
    browser.browserAction.setIcon(WittyIconActive);

    //Log install event to posthog
    analytics.extensionStatusLog('install', getBrowserId());

    //Open the welcome page
    if (!DEV_ENV) {
      browser.tabs.create({
        url: 'http://www.witty.works/welcome',
      });
    }
  }
  if (details.reason === 'update') {
    //Set icon according to the saved settings
    scanTabsToDetectStatus();

    //Log update event to posthog
    analytics.extensionStatusLog('update', getBrowserId());
  }
});

const getRandomToken = () => {
  const bytes = new Uint8Array(32); //256 bits token

  window.crypto.getRandomValues(bytes);

  // convert byte array to hexademical representation
  const bytesHex = bytes.reduce(
    (item, acc) => item + `00${acc.toString(16)}`.slice(-2),
    ''
  );

  // convert hexademical value to a decimal string
  return BigInt('0x' + bytesHex).toString(10);
};

const getBrowserId = () => {
  return DEV_ENV ? devAppId : getRandomToken();
};

const setInLocalStorage = (key: string, value: DefaultConfigValue): void => {
  //Check if setting is already defined in the local storage
  //If not, then add it
  browser.storage.local
    .get()
    .then((result) => {
      let savedValue: DefaultConfigValue = result[key];
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
      browser.storage.local.get(null).then((result) => {
        browser.browserAction.setIcon(
          (result[StorageKeys.DISABLED_SITES] &&
            result[StorageKeys.DISABLED_SITES].length > 0 &&
            result[StorageKeys.DISABLED_SITES].includes(domain)) ||
            (!defaultConfig.ACTIVE_SITES.includes(domain) &&
              !result[StorageKeys.ENABLE_WITTY_EVERYWHERE])
            ? WittyIconInactive
            : WittyIconActive
        );
      });
    } else if (
      defaultConfig.CHROME_AND_FIREFOX_SITES.includes(window.location.protocol)
    ) {
      browser.browserAction.setIcon(WittyIconActive);
    } else {
      browser.browserAction.setIcon(WittyIconInactive);
    }
  });
};

const storageChange = (changes: { [key: string]: any }) => {
  const changedItems = Object.keys(changes);
  changedItems.forEach((key) => {
    if (key === StorageKeys.ENABLE_WITTY_EVERYWHERE) {
      changes[key].newValue
        ? browser.browserAction.setIcon(WittyIconActive)
        : browser.browserAction.setIcon(WittyIconInactive);
    }
  });
};

browser.tabs.onCreated.addListener(scanTabsToDetectStatus);
browser.tabs.onUpdated.addListener(scanTabsToDetectStatus);
browser.tabs.onActivated.addListener(scanTabsToDetectStatus);
browser.storage.onChanged.addListener(storageChange);

//TODO Remove Listeners
