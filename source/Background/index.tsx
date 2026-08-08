import browser, {Tabs} from 'webextension-polyfill';
import * as Sentry from '@sentry/react';

import {
  StorageKeys,
  DEV_ENV,
  TESTING,
  WittyIconActive,
  wittyVersion,
  DefaultBaseUrlKey,
  registerCustomEndpointFromStorage,
  X_KEY,
} from '../shared/constants';
import {
  addBadge,
  addNotificationBadge,
  getDomainWithoutSubdomain,
  getRandomToken,
  getNewAccessToken,
  isFunction,
  logOut,
  removeBadge,
  storeInLocalStorage,
  updateLabelChrome,
} from '../shared/utils';
import {authorize} from '../shared/ApiServices/oauth';
import {setToken} from '../shared/ApiServices/requests';
import {
  allowSessionStorageInContentScripts,
  migrateAccessTokenOffDisk,
  persistTokens,
} from '../shared/tokenStore';
import {
  isWittyMessage,
  MessageTypes,
  OPEN_POPOVER_COMMAND,
  SignInResult,
} from '../shared/messages';
import defaultConfig from '../witty.config.json';
import {DefaultConfigValue} from '../shared/types';
import {logTypes, useLog} from '../shared/customHooks/useLog';
import {sendErrorToSentry} from '../shared/errorUtils';
import {registerErrorReporter} from '../shared/errorReporting';
import {isChromeWebstore} from '../shared/DOMutils';
import {registerStorage} from '../shared/platform/storage';
import {webextensionStorage} from '../shared/platform/webextensionStorage';

registerStorage(webextensionStorage);

const sentryDSN = defaultConfig.SENTRY_DSN;
const sentrySampleRate = defaultConfig.SENTRY_SAMPLE_RATE;
const sentryTraceRate = defaultConfig.SENTRY_TRACE_RATE;
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
    integrations: [Sentry.browserTracingIntegration()],
    sampleRate: sentrySampleRate,
    tracesSampleRate: sentryTraceRate,
  });
  registerErrorReporter((error) => Sentry.captureException(error));
}

/**
 * Resolve which deployment to authenticate against. Read at flow time rather
 * than cached, so a user who switches endpoints in the ApiSelector and then
 * signs in reaches the dashboard they just selected.
 */
const currentUrlKey = async (): Promise<string> => {
  const stored = await browser.storage.local.get([
    StorageKeys.API_ENDPOINT_KEY,
    StorageKeys.CUSTOM_ENDPOINT,
  ]);

  // Register before resolving the key, or a stored 'Custom' would not yet name
  // anything and would silently fall back to the build default.
  registerCustomEndpointFromStorage(stored);

  const key = stored[StorageKeys.API_ENDPOINT_KEY] as string | undefined;

  return key || DefaultBaseUrlKey;
};

const handleSignIn = async (register: boolean): Promise<SignInResult> => {
  try {
    const tokens = await authorize(await currentUrlKey(), register);

    // A null result means the user dismissed the auth window. Leave existing
    // credentials (if any) untouched — a cancelled sign-in must not log anyone
    // out of a session they already had.
    if (!tokens) {
      return {status: 'cancelled'};
    }

    await persistTokens(tokens);
    setToken(tokens.accessToken);
    removeBadge();

    return {status: 'success'};
  } catch (error) {
    log(`Sign-in failed: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);

    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

const addMessageListener = () => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    // `onMessage` is also reachable from other extensions. Only act on messages
    // originating from our own pages and content scripts.
    if (sender.id !== browser.runtime.id || !isWittyMessage(message)) {
      return undefined;
    }

    if (message.type === MessageTypes.SIGN_IN) {
      // Returning the promise keeps the message channel open until the flow
      // settles, which can be minutes if the user takes their time logging in.
      return handleSignIn(message.register);
    }

    if (message.type === MessageTypes.SIGN_OUT) {
      logOut();

      return Promise.resolve({status: 'success'} as SignInResult);
    }

    return undefined;
  });
};

const addEventListeners = () => {
  browser.tabs.onCreated.addListener(scanTabsToDetectStatus);
  browser.tabs.onCreated.addListener(scanTabsToSetIframeDomains);
  browser.tabs.onUpdated.addListener(scanTabsToDetectStatus);
  browser.tabs.onUpdated.addListener(scanTabsToSetIframeDomains);
  browser.tabs.onActivated.addListener(scanTabsToDetectStatus);
  browser.tabs.onActivated.addListener(scanTabsToSetIframeDomains);
  browser.storage.onChanged.addListener(storageChange);
  browser.storage.onChanged.addListener(scanTabsToDetectStatus);

  browser.runtime.onUpdateAvailable.addListener(() => {
    browser.runtime.reload();
  });

  // Keyboard shortcuts only fire in the background; the popover lives in the
  // content script, so forward the command to the active tab. All frames
  // receive it and the one owning the focused input reacts.
  browser.commands?.onCommand.addListener((command: string) => {
    if (command !== OPEN_POPOVER_COMMAND) {
      return;
    }

    browser.tabs
      .query({active: true, currentWindow: true})
      .then((tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId === undefined) {
          return undefined;
        }
        return browser.tabs.sendMessage(tabId, {
          type: MessageTypes.OPEN_POPOVER,
        });
      })
      .catch(() => {
        // No content script in this tab (e.g. browser-internal pages).
      });
  });

  browser.runtime.onInstalled.addListener(function (details: {reason: string}) {
    browser.action?.setIcon(WittyIconActive);

    if (!DEV_ENV) {
      browser.runtime.setUninstallURL(
        `https://www.witty.works/help?witty_version=${wittyVersion}&witty_browser=${navigator.userAgent}`
      );
    }

    if (details.reason === 'install') {
      //Set default settings
      setSettings();

      // Start the OAuth flow directly rather than opening a tab at the old
      // `browser-login?redirect_uri=…` URL, which no longer exists. A cancelled
      // or failed sign-in here is not worth surfacing: the user has just
      // installed the extension and can sign in from the popup whenever they
      // want, so failures are logged and otherwise ignored.
      !TESTING &&
        handleSignIn(false).catch((error) => {
          sendErrorToSentry(error);
        });

      reInjectContentScripts();
    } else if (details.reason === 'update') {
      //Set icon according to the saved settings
      scanTabsToDetectStatus();
      !DEV_ENV &&
        browser.storage.local.set({
          [StorageKeys.EXTENSION_WAS_UPDATED]: true,
        });
      reInjectContentScripts();
    }
  });
};

const reInjectContentScripts = () => {
  const manifest = browser.runtime.getManifest();
  // @ts-ignore
  const scripts = manifest.content_scripts || [];

  const matchPattern = (pattern: string, url: string): boolean => {
    // Parse pattern
    const [patternScheme, patternHost] = pattern.split('://');
    const [patternDomain, patternPath] = patternHost.split('/', 2);

    // Parse URL
    const urlObj = new URL(url);
    const urlDomain = urlObj.hostname;
    const urlPath = urlObj.pathname;

    // Check scheme
    if (
      patternScheme !== '*' &&
      patternScheme !== urlObj.protocol.replace(':', '')
    ) {
      return false;
    }

    // Check domain
    if (
      patternDomain !== '*' &&
      !urlDomain.endsWith(patternDomain.replace('*.', ''))
    ) {
      return false;
    }

    // Check path
    return !(patternPath !== '*' && !urlPath.startsWith('/' + patternPath));
  };

  const matchUrl = (url: string, patterns: string[]): boolean => {
    for (const pattern of patterns) {
      if (matchPattern(pattern, url)) {
        return true;
      }
    }

    return false;
  };

  const injectIntoTab = async (tab: Tabs.Tab) => {
    if (
      !tab.url ||
      tab.url.match(/(chrome):\/\//gi) ||
      isChromeWebstore(tab.url)
    ) {
      return;
    }

    if (browser.permissions) {
      const hasPermission = await browser.permissions.contains({
        origins: [new URL(tab.url).origin + '/*'],
      });
      if (!hasPermission) {
        return;
      }
    }

    scripts.forEach((script) => {
      const jsFiles = script.js || [];
      const cssFiles = script.css || []; // Get CSS files from the manifest
      const matches = script.matches;

      if (!matchUrl(tab.url!, matches) || jsFiles.length === 0) {
        return;
      }

      jsFiles.forEach((scriptToInject: string) => {
        browser.scripting
          .executeScript({
            //executeScript, but should be ob since browser.scripting?
            target: {tabId: tab.id!},
            files: [scriptToInject],
          })
          .catch(() => {
            // do nothing cause the tab does not exist anymore
          });
      });

      // Inject CSS files
      cssFiles.forEach((cssToInject: string) => {
        browser.scripting
          .insertCSS({
            files: [cssToInject],
            target: {tabId: tab.id!},
          })
          .catch(() => {
            // do nothing cause the tab does not exist anymore
          });
      });
    });
  };

  browser.windows
    .getAll({populate: true})
    .then((windows) => {
      windows.forEach((window) => {
        if (!window || !window.tabs) {
          return;
        }

        window.tabs.forEach((tab) => {
          injectIntoTab(tab);
        });
      });
    })
    .catch((error) => {
      sendErrorToSentry(error);
    });
};

const setInLocalStorage = (key: string, value: DefaultConfigValue): void => {
  //Check if setting is already defined in the local storage
  //If not, then add it
  browser.storage.local
    .get()
    .then((result) => {
      const savedValue: DefaultConfigValue = result[key];
      const appId = result[StorageKeys.APP_ID];
      if (!savedValue || savedValue == appId || DEV_ENV) {
        const valueToSave = isFunction(value as Function)
          ? (value as Function)()
          : value;
        browser.storage.local
          .set({[key]: valueToSave})
          .then(() => onSave(key, valueToSave))
          .catch(onError);
      }
    })
    .catch(onError);
};

const setSettings = () => {
  //Set default settings
  for (const [defaultConfigKey, defaultConfigValue] of Object.entries(
    defaultConfig
  )) {
    // If an X_KEY is configured, do not persist OAuth tokens from the config
    if (
      X_KEY &&
      (defaultConfigKey === 'ACCESS_TOKEN' ||
        defaultConfigKey === 'REFRESH_TOKEN')
    ) {
      continue;
    }
    if (defaultConfigKey in StorageKeys) {
      const storageKey =
        StorageKeys[defaultConfigKey as keyof typeof StorageKeys];
      setInLocalStorage(storageKey, defaultConfigValue);
    }
  }
  //Set browser id
  setInLocalStorage(StorageKeys.APP_ID, getRandomToken());
};

const scanTabsToSetIframeDomains = () => {
  browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
    if (tabs.length != 0 && tabs[0].url) {
      browser.scripting
        .executeScript({
          target: {tabId: tabs[0].id!},
          func: () =>
            Array.from(document.getElementsByTagName('iframe')).map(
              (iframe) => iframe.src
            ),
        })
        .then((result) => {
          const iframes = result[0].result;
          if (iframes) {
            const iframeDomains = iframes
              .filter((iframe: string) => iframe !== '')
              .map((iframe: string) => {
                try {
                  const url = new URL(iframe);
                  return getDomainWithoutSubdomain(url.hostname);
                } catch (e) {
                  console.error('Invalid URL provided:', iframe, e);
                  return null;
                }
              });
            storeInLocalStorage(StorageKeys.IFRAME_DOMAINS, iframeDomains);
          } else {
            storeInLocalStorage(StorageKeys.IFRAME_DOMAINS, []);
          }
        })
        .catch((error) => {
          sendErrorToSentry(error);
        });
    }
  });
};

const scanTabsToDetectStatus = () => {
  browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
    if (tabs.length != 0 && tabs[0].url) {
      const domain = getDomainWithoutSubdomain(new URL(tabs[0].url).hostname);
      updateLabelChrome(domain);
    } else {
      removeBadge();
    }
  });
};

const storageChange = (changes: {[key: string]: any}) => {
  const changedItems = Object.keys(changes);

  changedItems.forEach((key) => {
    if (key === StorageKeys.SIGNED_IN && !changes[key].newValue) {
      addBadge('Login');
    } else if (key === StorageKeys.NUMBER_OF_NOTIFICATIONS) {
      changes[key].newValue === 0
        ? removeBadge()
        : addNotificationBadge(changes[key].newValue);
    }
  });
};
// If an X_KEY is configured, purge any stored OAuth tokens and ensure runtime
// token state doesn't conflict with API-key mode.
if (X_KEY) {
  try {
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, '');
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, '');
  } catch (e) {
    sendErrorToSentry(e as Error);
  }
}

addEventListeners();
addMessageListener();

// Test-only seam. Lets the live OAuth e2e spec drive a refresh without adding a
// production message type for it.
//
// The guard survives minification as `TESTING && (self.__wittyTestRefresh =
// ...)` rather than being eliminated — webpack does not fold this cross-module
// constant. TESTING is compiled to `false` in release builds, so the assignment
// never runs and nothing is exposed; only the dead branch remains in the bundle.
if (TESTING) {
  (
    self as unknown as {__wittyTestRefresh?: () => Promise<void>}
  ).__wittyTestRefresh = getNewAccessToken;
}

// The access token lives in storage.session, which Chrome hides from content
// scripts by default — the popover and content script both need it to call the
// API. Then move any token left on disk by a previous version into session.
allowSessionStorageInContentScripts()
  .then(migrateAccessTokenOffDisk)
  .catch((error) => sendErrorToSentry(error));
//TODO Remove Listeners
