import browser from 'webextension-polyfill';
import { DEV_ENV, StorageKeys, wittyVersion } from './constants';
import { sendErrorToSentry } from './errorUtils';
import defaultConfig from '../witty.config.json';
import { isGoogleDocs, isMicrosoftOnline, isTextArea, requiresRectRecalculation } from './DOMutils';
import { getToken } from './ApiServices/requests';

export const isObjectEmpty = (obj: object) =>
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

export const isFunction = (functionToCheck: Function) =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';

export const storeInLocalStorage = (key: string, value: any) => {
  if (!key) {
    return;
  }
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

      DEV_ENV &&
        console.log(
          `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
          `color: #55B8E9`,
          `color: #5fca7d`,
          `color: #000`
        );
    })
    .catch((error: unknown) => {
      const componentName = 'Utils';
      const message = `onBrowserStorage Error: ${error}`;

      DEV_ENV && console.log(
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

export const addNotificationBadge = (numberOfNotifications: number) => {
  browser.action?.setBadgeBackgroundColor({
    color: '#E6635A',
  });

  browser.action?.setBadgeText({
    text: numberOfNotifications.toString(),
  });
  // for firefox mv2
  browser.browserAction?.setBadgeBackgroundColor({
    color: '#E6635A',
  });

  browser.browserAction?.setBadgeText({
    text: numberOfNotifications.toString(),
  });
};

export const addBadge = (text: string) => {
  browser.action?.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.action?.setBadgeText({ text: text });
  // for firefox mv2
  browser.browserAction?.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.browserAction?.setBadgeText({ text: text });
}

export const getNewAccessToken = async () => {
  browser.storage.local.get(StorageKeys.REFRESH_TOKEN).then((result) => {
    if (!result[StorageKeys.REFRESH_TOKEN]) {
      logOut();
      return;
    }
    const request = getToken(result[StorageKeys.REFRESH_TOKEN]);
    if (!request.config) {
      logOut();
      return;
    }
    fetch(request.url, request.config).then(async (response) => {
      if (!response || !response.ok) {
        logOut();
        return;
      }
      const responseJson = await response.json();
      storeInLocalStorage(
        StorageKeys.REFRESH_TOKEN,
        responseJson.refresh_token
      );
      storeInLocalStorage(StorageKeys.ACCESS_TOKEN, responseJson.access_token);
    });
  });
};

export const logOut = () => {
  storeInLocalStorage(StorageKeys.APP_ID, getRandomToken());
  storeInLocalStorage(StorageKeys.USER_ID, '');
  storeInLocalStorage(StorageKeys.ID_WAS_ALIASED, false);
  storeInLocalStorage(StorageKeys.ACCESS_TOKEN, '');
  storeInLocalStorage(StorageKeys.REFRESH_TOKEN, '');
  storeInLocalStorage(StorageKeys.PLAN, '');
  addBadge('Login');
};

export const removeBadge = () => {
  browser.action?.setBadgeText({ text: '' });
  // for firefox mv2
  browser.browserAction?.setBadgeText({ text: '' });
};

export const getRandomToken = () => {
  const bytes = new Uint8Array(32); //256 bits token

  crypto.getRandomValues(bytes);

  // convert byte array to hexademical representation
  const bytesHex = bytes.reduce(
    (item, acc) => item + `00${acc.toString(16)}`.slice(-2),
    ''
  );

  // convert hexademical value to a decimal string
  return BigInt('0x' + bytesHex).toString(10);
};

export const updateLabelChrome = (domain: string) => {
  browser.storage.local.get(null).then((result) => {
    if (!result[StorageKeys.ACCESS_TOKEN]) {
      addBadge('Login');
      return;
    }

    const orgDomains = result[StorageKeys.ORGANIZATION_DOMAINS];
    const domainList = Array.isArray(orgDomains?.list) ? orgDomains.list : [];
    const isLocked = orgDomains 
      ? (orgDomains.type === 'deny' && domainList.includes(domain)) || 
        (orgDomains.type === 'allow' && !domainList.includes(domain))
      : false;

    const isDisabled = result[StorageKeys.DOMAINS]?.includes(domain);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (!tabs[0]?.url) return;
      
      const domainOnDisabledSitesList = defaultConfig.DISABLED_SITES.includes(domain) || isMicrosoftOnline(new URL(tabs[0].url).href);
      const numberOfNotifications = result[StorageKeys.NUMBER_OF_NOTIFICATIONS];
      
      if (isLocked || isDisabled || domainOnDisabledSitesList) {
        addBadge('OFF');
      } else if (numberOfNotifications > 0) {
        addNotificationBadge(numberOfNotifications);
      } else {
        removeBadge();
      }
    }).catch((error) => {
      sendErrorToSentry(error);
    });
  });
};

export const getCorrectedPosition = (elementRect: DOMRect, parentElement: HTMLElement | null, element: HTMLElement) => {
  const parentRect = parentElement?.getBoundingClientRect();
  const isFirefox = navigator.userAgent.match(/firefox|fxios/i);
  const textArea = isTextArea(element);

  if (requiresRectRecalculation(element)) {
    elementRect = element.getBoundingClientRect();
  }
const topLevelWindow = element.ownerDocument.defaultView;
  if (parentRect && !isObjectEmpty(parentRect) && topLevelWindow) {
    const scrollY = textArea ? 0 : topLevelWindow.scrollY;
    const scrollX = textArea ? 0 : topLevelWindow.scrollX;

    const top = isFirefox && !isGoogleDocs() ? 0 : elementRect.top - parentRect.top - scrollY;
    const left = elementRect.left - parentRect.left - scrollX;

    return { top, left };
  }

  return { top: elementRect.top, left: elementRect.left };
};

export const getCorrectedPositionCanvas = (element: HTMLElement) => {
  const updatedElementRect = element.getBoundingClientRect();

  const scrollLeft = element.parentElement?.parentElement?.scrollLeft;
  const scrollTop = element.parentElement?.parentElement?.scrollTop;
  return {
    top: scrollTop ? scrollTop : 0,
    left: updatedElementRect.left + (scrollLeft ? scrollLeft : 0),
  };
};

export const getScrollableParentClosestToElement = (element: HTMLElement) => {
  let style = getComputedStyle(element);
  const excludeStaticParent = style.position === 'absolute';
  const overflowRegex = /(auto|scroll)/;
  if (style.position === 'fixed') return document.body;
  for (let parent = element; (parent = parent.parentElement as HTMLElement); ) {
    style = getComputedStyle(parent);
    if (excludeStaticParent && style.position === 'static') {
      continue;
    }
    if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX))
      return parent;
  }
  return document.body;
};

export const getFrameDepth = (windowToIdentify: Window): number => {
  if (windowToIdentify === window.top) {
    return 0;
  }
  else if (windowToIdentify.parent === window.top) {
    return 1;
  }

  return 1 + getFrameDepth (windowToIdentify.parent);
};

export const shouldInjectIntoWindow = (windowToCheck: Window) => {
  const frameDepth = getFrameDepth(windowToCheck);
  const isVisible = windowToCheck.innerWidth >= 10 && windowToCheck.innerHeight >= 10;
  return frameDepth < 2 && isVisible;
};
