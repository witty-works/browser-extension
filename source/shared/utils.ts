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
import { isTextArea } from './DOMutils';

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
    .slice(urlParts.length - 2)
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

export const addNotificationBadge = (numberOfNotifications: number) => {
  browser.browserAction.setBadgeBackgroundColor({
    color: '#E6635A',
  });

  browser.browserAction.setBadgeText({
    text: numberOfNotifications.toString(),
  });
};

export const addInactiveBadge = () => {
  browser.browserAction.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.browserAction.setBadgeText({ text: 'OFF' });
};

export const addLoginBadge = () => {
  browser.browserAction.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.browserAction.setBadgeText({ text: 'Login' });
};

export const removeBadge = () => {
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
    const userLoggedIn = result[StorageKeys.ACCESS_TOKEN];
    if (!userLoggedIn) {
      addLoginBadge();
      return;
    }

    const isLocked =
      (result[StorageKeys.ORGANIZATION_DOMAINS] &&
        result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
      (result[StorageKeys.ORGANIZATION_DOMAINS] &&
        result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
        result[StorageKeys.ORGANIZATION_DOMAINS].list &&
        !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain));

    const isDisabled = result[StorageKeys.DOMAINS].includes(domain);

    const domainConfirmedToNotWork = result[
      StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK
    ]
      ? result[StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK]
          .filter((domain: string) => {
            const domainTimestamp = domain.split('-')[1];
            const domainDate = new Date(parseInt(domainTimestamp));
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return domainDate > threeMonthsAgo;
          })
          .map((d: string) => {
            return d.split('-')[0];
          })
          .includes(domain)
      : false;

    const domainOnDisabledSitesList =
      defaultConfig.DISABLED_SITES.includes(domain);

    const numberOfNotifications = result[StorageKeys.NUMBER_OF_NOTIFICATIONS];
    if (
      isLocked ||
      isDisabled ||
      domainConfirmedToNotWork ||
      domainOnDisabledSitesList
    ) {
      addInactiveBadge();
    } else if (numberOfNotifications > 0) {
      addNotificationBadge(numberOfNotifications);
    } else {
      removeBadge();
    }
  });
};

export const getCorrectedPosition = (
  elementRect: DOMRect,
  parentElement: HTMLElement | null,
  element: HTMLElement
) => {
  if (isTextArea(element)) {
    elementRect = element.getBoundingClientRect();
  }

  return parentElement && !isObjectEmpty(parentElement)
    ? {
        top: navigator.userAgent.match(/firefox|fxios/i)
          ? 0
          : elementRect.top - parentElement.getBoundingClientRect().top,
        left: elementRect.left - parentElement.getBoundingClientRect().left,
      }
    : {
        top: elementRect.top,
        left: elementRect.left,
      };
};
