import {browser, Tabs} from 'webextension-polyfill-ts';
import * as Sentry from '@sentry/react';

import {
  StorageKeys,
  DEV_ENV,
  TESTING,
  WittyIconActive,
  wittyVersion,
  DefaultBaseUrlKey,
  BaseUrls,
} from '../shared/constants';
import {
  addInactiveBadge,
  addLoginBadge,
  addNotificationBadge,
  getDomainWithoutSubdomain,
  getRandomToken,
  isFunction,
  removeBadge,
  updateLabelChrome,
} from '../shared/utils';
import defaultConfig from '../witty.config.json';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { DefaultConfigValue } from '../shared/types';
import { useLog } from '../shared/customHooks/useLog';
import { sendErrorToSentry } from '../shared/errorUtils';

const sentryDSN = defaultConfig.SENTRY_DSN;
const sentrySampleRate = defaultConfig.SENTRY_SAMPLE_RATE;
const sentryTraceRate = defaultConfig.SENTRY_TRACE_RATE;
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

if (sentryDSN) {
  Sentry.init({
    dsn: sentryDSN,
    release: wittyVersion,
    integrations: [new Sentry.BrowserTracing()],
    sampleRate: sentrySampleRate,
    tracesSampleRate: sentryTraceRate,
  });  
}

const addEventListeners = () => {
  browser.tabs.onCreated.addListener(scanTabsToDetectStatus);
  browser.tabs.onUpdated.addListener(scanTabsToDetectStatus);
  browser.tabs.onActivated.addListener(scanTabsToDetectStatus);
  browser.storage.onChanged.addListener(storageChange);

  browser.runtime.onUpdateAvailable.addListener(() => {
    browser.runtime.reload();
  });

  browser.runtime.onInstalled.addListener(function (details: { reason: string }) {
    analytics.extensionInstallationAndUpdateLog(details.reason);
    browser.browserAction?.setIcon(WittyIconActive);
    if (!DEV_ENV)
      browser.runtime.setUninstallURL(`https://www.witty.works/goodbye?witty_version=${wittyVersion}&witty_browser=${navigator.userAgent}`);
    if (details.reason === 'install') {
      //Set default settings
      setSettings();
      browser.storage.local.get(null).then((result) => {
        const optionsPageUrl = browser.extension.getURL('options.html');
        const urls = result[StorageKeys.API_ENDPOINT_KEY]
          ? result[StorageKeys.API_ENDPOINT_KEY]
          : DefaultBaseUrlKey;
  
        !TESTING &&
          browser.tabs.create({
            url: `
          ${BaseUrls[urls].dashboard}browser-login?redirect_uri=${optionsPageUrl}`,
          });
      }).catch((error) => {
        sendErrorToSentry(error);
      });
      reInjectContentScripts();
    }
    if (details.reason === 'update') {
      //Set icon according to the saved settings
      scanTabsToDetectStatus();
      !DEV_ENV && browser.storage.local.set({ [StorageKeys.EXTENSION_WAS_UPDATED]: true });
      reInjectContentScripts();
    }
  });
};

const reInjectContentScripts = () => {
  const manifest = browser.runtime.getManifest();
  // @ts-ignore
  const scripts = manifest.content_scripts;

  const matchPattern = (pattern: string, url: string): boolean => {
    // Parse pattern
    let [patternScheme, patternHost] = pattern.split("://");
    let [patternDomain, patternPath] = patternHost.split("/", 2);

    // Parse URL
    let urlObj = new URL(url);
    let urlDomain = urlObj.hostname;
    let urlPath = urlObj.pathname;

    // Check scheme
    if (patternScheme !== "*" && patternScheme !== urlObj.protocol.replace(":", "")) {
      return false;
    }

    // Check domain
    if (patternDomain !== "*" && !urlDomain.endsWith(patternDomain.replace("*.", ""))) {
      return false;
    }

    // Check path
    return !(patternPath !== "*" && !urlPath.startsWith("/" + patternPath));
  }

  const matchUrl = (url: string, patterns: string[]): boolean => {
    for (let pattern of patterns) {
      if (matchPattern(pattern, url)) {
        return true;
      }
    }

    return false;
  }


  const injectIntoTab = (tab: Tabs.Tab) => {
    if (!tab.url || tab.url.match(/(chrome):\/\//gi)) {
      return;
    }

    scripts.forEach((script: { js: any; matches: any; css: any}) => {
      const jsFiles = script.js || [];
      const cssFiles = script.css || []; // Get CSS files from the manifest
      const matches = script.matches;

      if (!matchUrl(tab.url!, matches) || jsFiles.length === 0) {
        return;
      }

      jsFiles.forEach((scriptToInject: string) => {
        browser.tabs.executeScript(tab.id!, {
          file: scriptToInject,
          allFrames: true
        });
      });
  
      // Inject CSS files
      cssFiles.forEach((cssToInject: string) => {
        browser.tabs.insertCSS(tab.id!, {
          file: cssToInject,
          allFrames: true
        });
      });
    });
  };

  browser.windows.getAll({ populate: true }).then((windows) => {
    windows.forEach((window) => {
      if (!window || !window.tabs) {
        return;
      }

      window.tabs.forEach(tab => {
        injectIntoTab(tab);
      });
    });
  }).catch((error) => {
    sendErrorToSentry(error);
  });
};

const setInLocalStorage = (key: string, value: DefaultConfigValue): void => {
  //Check if setting is already defined in the local storage
  //If not, then add it
  browser.storage.local
    .get()
    .then((result) => {
      let savedValue: DefaultConfigValue = result[key];
      const appId = result[StorageKeys.APP_ID];
      if (!savedValue || savedValue == appId || DEV_ENV) {
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
  setInLocalStorage(StorageKeys.APP_ID, getRandomToken());
};

const scanTabsToDetectStatus = () => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs.length != 0 && tabs[0].url) {
      const domain = getDomainWithoutSubdomain(new URL(tabs[0].url).hostname);

      browser.tabs
        .executeScript(tabs[0].id!, {
          code: `
          Array.from(document.querySelectorAll('iframe')).map((iframe) => {
            return iframe.src;
          });
        `,
        })
        .then((result) => {
          const iframes = result[0];
          if (iframes) {
            const iframeDomains = iframes.map((iframe: string) => {
              try {
                  const url = new URL(iframe);
                  return getDomainWithoutSubdomain(url.hostname);
              } catch (e) {
                  console.error("Invalid URL provided:", iframe, e);
                  return null;
              }
          });
      
          browser.storage.local.set({
              [StorageKeys.IFRAME_DOMAINS]: iframeDomains,
          });
          } else {
            browser.storage.local.set({
              [StorageKeys.IFRAME_DOMAINS]: [],
            });
          }
        }).catch((error) => {
          sendErrorToSentry(error);
        });

      updateLabelChrome(domain);
    } else if (
      defaultConfig.CHROME_AND_FIREFOX_SITES?.includes(window.location.protocol)
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
          changes[key].newValue.list?.includes(
            getDomainWithoutSubdomain(window.location.hostname)
          )) ||
        (changes[key].newValue.type === 'allow' &&
          !changes[key].newValue.list?.includes(
            getDomainWithoutSubdomain(window.location.hostname)
          ))
      ) {
        addInactiveBadge();
      } else {
        removeBadge();
      }
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
