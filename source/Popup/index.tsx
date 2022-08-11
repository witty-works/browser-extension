import defaultConfig from '../witty.config.json';
import { browser } from 'webextension-polyfill-ts';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { StorageKeys } from '../shared/constants';
import { sendErrorToSentry } from '../shared/errorUtils';
import {
  renderDomainDeactivated,
  renderDomainOnListPopup,
  renderMainPopup,
  renderPopupChrome,
  renderUserNotLoggedIn,
} from './PopupUtils';

browser.storage.local
  .get(null)
  .then((result) => {
    if (!result[StorageKeys.ACCESS_TOKEN]) {
      renderUserNotLoggedIn();
      return;
    }

    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs.length != 0 && tabs[0].url) {
          const domain = getDomainWithoutSubdomain(
            new URL(tabs[0].url).hostname
          );
          renderPopupChrome(domain, result);
        } else {
          defaultConfig.CHROME_AND_FIREFOX_SITES.includes(
            window.location.protocol
          )
            ? renderMainPopup()
            : renderDomainDeactivated();
        }
      })
      .catch((error: unknown) => {
        sendErrorToSentry(error);
      });
  })
  .catch((error: unknown) => {
    sendErrorToSentry(error);
  });

const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);
  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.ACCESS_TOKEN:
        !changes[item].newValue && renderUserNotLoggedIn();
        break;
      case StorageKeys.ENABLE_WITTY_EVERYWHERE:
        changes[item].newValue ? renderMainPopup() : renderDomainDeactivated();
        break;
      case StorageKeys.ORGANIZATION_DOMAINS:
        if (
          (changes[item].newValue.type === 'deny' &&
            changes[item].newValue.list.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            )) ||
          (changes[item].newValue.type === 'allow' &&
            !changes[item].newValue.list.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            ))
        ) {
          renderDomainOnListPopup(changes[item].newValue.type);
        }
        break;
    }
  }
};

browser.storage.onChanged.addListener(storageChange);
//TODO call removeListener
