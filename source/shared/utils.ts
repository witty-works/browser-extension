import { browser } from 'webextension-polyfill-ts';
import { wittyVersion, WTags } from './constants';

import { sendErrorToSentry } from './errorUtils';

const isObjectEmpty = (obj: object) =>
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

const isFunction = (functionToCheck: Function) =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';

const storeInLocalStorage = (key: string, value: any) => {
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

const getDomainWithoutSubdomain = (url: string) => {
  const urlParts = url.split('.');
  return urlParts
    .slice(0)
    .slice(-(urlParts.length === 4 ? 3 : 2))
    .join('.');
};
const singularTheyToBoolean = (value: string) =>
  value === 'he_or_she' ? false : true;

const changeSingularThey = (value: boolean) =>
  value ? 'all_pronouns' : 'he_or_she';

const maximumImportanceToBoolean = (value: number) =>
  value === 3 ? true : false;

const changeMaximumImportance = (value: boolean) => (value ? 3 : 2);

const getFirstTextDiff = (previousText: string, nextText: string) => {
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

const addInactiveLabel = () => {
  browser.browserAction.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.browserAction.setBadgeText({ text: 'OFF' });
};

const removeInactiveLabel = () => {
  browser.browserAction.setBadgeText({ text: '' });
};

export {
  isObjectEmpty,
  isFunction,
  storeInLocalStorage,
  getDomainWithoutSubdomain,
  singularTheyToBoolean,
  changeSingularThey,
  maximumImportanceToBoolean,
  changeMaximumImportance,
  getFirstTextDiff,
  addInactiveLabel,
  removeInactiveLabel,
};
