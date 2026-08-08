import defaultConfig from '../witty.config.json';
import browser from 'webextension-polyfill';
import {
  getDomainWithoutSubdomain,
  makeAuthRequest,
  isSignedInResult,
} from '../shared/utils';
import {StorageKeys} from '../shared/constants';
import {sendErrorToSentry} from '../shared/errorUtils';
import {
  renderMainPopup,
  renderPopupChrome,
  renderUserNotLoggedIn,
} from './PopupUtils';
import {initI18n} from '../i18n/i18n';
import {registerStorage} from '../shared/platform/storage';
import {webextensionStorage} from '../shared/platform/webextensionStorage';

registerStorage(webextensionStorage);
initI18n();

const renderPopup = async () => {
  browser.storage.local
    .get(null)
    .then((result) => {
      if (!isSignedInResult(result)) {
        renderUserNotLoggedIn();
        return;
      }

      const appId = result[StorageKeys.APP_ID];
      let isLocked = false;
      let domain = getDomainWithoutSubdomain(window.location.hostname);
      if (
        (!window.location.protocol.includes('http') &&
          !window.location.protocol.includes('https')) ||
        !domain
      ) {
        domain = '';
      }

      if (
        (result[StorageKeys.ORGANIZATION_DOMAINS]?.type === 'deny' &&
          result[StorageKeys.ORGANIZATION_DOMAINS]?.list?.includes(domain)) ||
        (result[StorageKeys.ORGANIZATION_DOMAINS]?.type === 'allow' &&
          !result[StorageKeys.ORGANIZATION_DOMAINS]?.list.includes(domain))
      ) {
        isLocked = true;
      }

      browser.tabs
        .query({active: true, currentWindow: true})
        .then((tabs) => {
          if (tabs.length != 0 && tabs[0].url) {
            domain = getDomainWithoutSubdomain(new URL(tabs[0].url).hostname);
            if (!domain) return;
            renderPopupChrome(
              appId,
              domain,
              new URL(tabs[0].url).href,
              isLocked
            );
          } else if (
            defaultConfig.CHROME_AND_FIREFOX_SITES.includes(
              window.location.protocol
            )
          ) {
            renderMainPopup(appId, domain, isLocked);
          }
        })
        .catch((error: unknown) => {
          sendErrorToSentry(error);
        });
    })
    .catch((error: unknown) => {
      sendErrorToSentry(error);
    });
};

const storageChange = (changes: any) => {
  const changedItems = Object.keys(changes);
  for (const item of changedItems) {
    switch (item) {
      case StorageKeys.SIGNED_IN:
        !changes[item].newValue && renderUserNotLoggedIn();
        break;
      case StorageKeys.CHECK_ENDPOINT_SUCCESS:
        // If check endpoint becomes false, show login. If it becomes true, re-render popup.
        !changes[item].newValue ? renderUserNotLoggedIn() : renderPopup();
        break;
      case StorageKeys.ORGANIZATION_DOMAINS:
        renderPopup();
        break;
    }
  }
};

renderPopup();
browser.storage.onChanged.addListener(storageChange);
//TODO call removeListener

makeAuthRequest();
