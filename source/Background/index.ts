import { browser } from 'webextension-polyfill-ts';

import {
  StorageKeys,
  DEV_ENV,
  WittyIconActive,
  WittyIconInactive,
} from '../shared/constants';
import { isFunction } from '../shared/utils';
import defaultConfig from '../witty.config.json';
import { useLog } from '../shared/customHooks/useLog';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';

const analytics = useAnalytics();

const scanTabs = () => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    var tab = tabs[0];
    if (!tab.url) return;
    var domain = new URL(tab.url).hostname.replace('www.', '');

    browser.storage.local.get(StorageKeys.DISABLED_SITES).then((result) => {
      if (result[StorageKeys.DISABLED_SITES].includes(domain)) {
        browser.browserAction.setIcon(WittyIconInactive);
      } else {
        browser.browserAction.setIcon(WittyIconActive);
      }
    });
  });
};

browser.tabs.onUpdated.addListener(scanTabs);
browser.tabs.onCreated.addListener(scanTabs);

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
    //Update icon
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      var tab = tabs[0];
      if (!tab.url) return;
      var domain = new URL(tab.url).hostname.replace('www.', '');

      browser.storage.local.get(StorageKeys.DISABLED_SITES).then((result) => {
        result[StorageKeys.DISABLED_SITES].includes(domain)
          ? browser.browserAction.setIcon(WittyIconInactive)
          : browser.browserAction.setIcon(WittyIconActive);
      });
    });

    //Log update event to posthog
    analytics.extensionStatusLog('update', getBrowserId());
  }
});

const log = useLog('Background index');

const devAppId = 'DEV_APP_ID';

type DefaultConfigValue = string | boolean | string[] | (() => string);

const onSave = (key: string, value: DefaultConfigValue) => {
  log(`Key *${key}* with value *${value}* saved correctly in local storage`);
};

const onError = (error: string) => {
  log(`Local Storage Error: ${error}`);
};

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
