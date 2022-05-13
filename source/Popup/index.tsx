import React from 'react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import PopupDomainDeactivated from './PopupDomainDeactivated';
import Popup from './Popup';
import { browser } from 'webextension-polyfill-ts';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { StorageKeys } from '../shared/constants';

browser.storage.local
  .get(StorageKeys.ENABLE_WITTY_EVERYWHERE)
  .then((result) => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs.length != 0 && tabs[0].url) {
        const domain = getDomainWithoutSubdomain(new URL(tabs[0].url).hostname);
        ReactDOM.render(
          defaultConfig.ACTIVE_SITES.includes(domain) ||
            result[StorageKeys.ENABLE_WITTY_EVERYWHERE] ? (
            <Popup />
          ) : (
            <PopupDomainDeactivated />
          ),
          document.getElementById('popup-root')
        );
      } else if (
        defaultConfig.CHROME_AND_FIREFOX_SITES.includes(
          window.location.protocol
        )
      ) {
        ReactDOM.render(<Popup />, document.getElementById('popup-root'));
      } else
        ReactDOM.render(
          <PopupDomainDeactivated />,
          document.getElementById('popup-root')
        );
    });
  });

const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);
  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.ENABLE_WITTY_EVERYWHERE:
        changes[item].newValue
          ? ReactDOM.render(<Popup />, document.getElementById('popup-root'))
          : ReactDOM.render(
              <PopupDomainDeactivated />,
              document.getElementById('popup-root')
            );
        break;
    }
  }
};

browser.storage.onChanged.addListener(storageChange);
