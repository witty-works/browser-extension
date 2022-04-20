import * as React from 'react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import PopupDomainDeactivated from './PopupDomainDeactivated';
import Popup from './Popup';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../shared/constants';

const activeSites = defaultConfig.ACTIVE_SITES;
browser.storage.local.get(StorageKeys.CURRENT_DOMAIN).then((result) => {
  ReactDOM.render(
    activeSites.includes(result[StorageKeys.CURRENT_DOMAIN]) ? (
      <Popup />
    ) : (
      <PopupDomainDeactivated />
    ),
    document.getElementById('popup-root')
  );
});
