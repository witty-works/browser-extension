import React from 'react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import PopupDomainDeactivated from './PopupDomainDeactivated';
import Popup from './Popup';
import PopupLogin from './PopupLogin';
import { browser } from 'webextension-polyfill-ts';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { StorageKeys } from '../shared/constants';
import { sendErrorToSentry } from '../shared/errorUtils';

const renderUserNotLoggedIn = () => {
  ReactDOM.render(<PopupLogin />, document.getElementById('popup-root'));
};

const renderDomainDeactivated = () => {
  ReactDOM.render(
    <PopupDomainDeactivated />,
    document.getElementById('popup-root')
  );
};

const renderMainPopup = () => {
  ReactDOM.render(<Popup />, document.getElementById('popup-root'));
};

browser.storage.local
  .get(null)
  .then((result) => {
    if (result[StorageKeys.ACCESS_TOKEN] == '') {
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

          defaultConfig.ACTIVE_SITES.includes(domain) ||
          result[StorageKeys.ENABLE_WITTY_EVERYWHERE]
            ? renderMainPopup()
            : renderDomainDeactivated();
        } else if (
          defaultConfig.CHROME_AND_FIREFOX_SITES.includes(
            window.location.protocol
          )
        ) {
          renderMainPopup();
        } else {
          renderDomainDeactivated();
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
        changes[item].newValue == '' && renderUserNotLoggedIn();
        break;
      case StorageKeys.ENABLE_WITTY_EVERYWHERE:
        changes[item].newValue ? renderMainPopup() : renderDomainDeactivated();
        break;
    }
  }
};

browser.storage.onChanged.addListener(storageChange);
//TODO call removeListener
