import { browser } from 'webextension-polyfill-ts';
import { useAnalytics } from './ApiServices/useAnalytics';
import {
  devAppId,
  DEV_ENV,
  StorageKeys,
  wittyVersion,
  WTags,
} from './constants';
import { sendErrorToSentry } from './errorUtils';
import defaultConfig from '../witty.config.json';

export const isObjectEmpty = (obj: object) =>
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

export const isFunction = (functionToCheck: Function) =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';

export const storeInLocalStorage = (key: string, value: any) => {
  browser.storage.local
    .set({ [key]: value })
    .then(() => {
      //TODO bug, some values are not pronted correctly (for example arrays)
      const componentName = 'Utils';
      const message = value
        ? `${key}(${typeof value}) *${(typeof value === 'object'
            ? JSON.stringify(value)
            : value
          ).toString()}* correctly saved`
        : `value with key: ${key} is undefined`;
      // const data = typeof value === 'object' ? Object.keys(value) : value;

      console.log(
        `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
        `color: #55B8E9`,
        `color: #5fca7d`,
        `color: #000`
      );
    })
    .catch((error: unknown) => {
      //this error means that the extension was deactivated or uninstalled, in this case we delete the container
      if (error == 'Error: Extension context invalidated.') {
        useAnalytics().extenstionStatusLog('deactivated');
        const container = document.getElementsByTagName(WTags.WW_CONTAINER);
        if (container.length > 0) {
          container[0].remove();
        }
      }

      const componentName = 'Utils';
      const message = `onBrowserStorage Error: ${error}`;

      console.log(
        `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
        `color: #55B8E9`,
        `color: #5fca7d`,
        `color: #f00`
      );

      sendErrorToSentry(error);
    });
};

export const getDomainWithoutSubdomain = (url: string) => {
  const urlParts = url.split('.');
  return urlParts
    .slice(0)
    .slice(-(urlParts.length === 4 ? 3 : 2))
    .join('.');
};
export const singularTheyToBoolean = (value: string) =>
  value === 'he_or_she' ? false : true;

export const changeSingularThey = (value: boolean) =>
  value ? 'all_pronouns' : 'he_or_she';

export const maximumImportanceToBoolean = (value: number) =>
  value === 3 ? true : false;

export const changeMaximumImportance = (value: boolean) => (value ? 3 : 2);

export const getFirstTextDiff = (previousText: string, nextText: string) => {
  let i = 0;
  while (
    i < previousText.length &&
    i < nextText.length &&
    previousText[i] == nextText[i]
  ) {
    i++;
  }
  return i;
};

export const addInactiveLabel = () => {
  browser.browserAction.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.browserAction.setBadgeText({ text: 'OFF' });
};

export const removeInactiveLabel = () => {
  browser.browserAction.setBadgeText({ text: '' });
};

export const getRandomToken = () => {
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

export const getBrowserId = () => {
  return DEV_ENV ? devAppId : getRandomToken();
};

export const updateLabelChrome = (domain: string) => {
  browser.storage.local.get(null).then((result) => {
    if (
      (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
      (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
        !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain))
    ) {
      addInactiveLabel();
    } else if (
      (result[StorageKeys.DISABLED_SITES] &&
        result[StorageKeys.DISABLED_SITES].length > 0 &&
        result[StorageKeys.DISABLED_SITES].includes(domain)) ||
      (defaultConfig.ACTIVE_SITES &&
        !defaultConfig.ACTIVE_SITES.includes(domain) &&
        !result[StorageKeys.ENABLE_WITTY_EVERYWHERE]) ||
      !result[StorageKeys.ACCESS_TOKEN]
    ) {
      addInactiveLabel();
    } else {
      removeInactiveLabel();
    }
  });
};
