import * as React from 'react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import PopupDomainDeactivated from './PopupDomainDeactivated';
import Popup from './Popup';
import { browser } from 'webextension-polyfill-ts';

browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs.length === 0 || !tabs[0].url)
    //Empty tab
    ReactDOM.render(
      <PopupDomainDeactivated />,
      document.getElementById('popup-root')
    );
  else {
    const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');
    ReactDOM.render(
      defaultConfig.ACTIVE_SITES.includes(currentDomain) ? (
        <Popup />
      ) : (
        <PopupDomainDeactivated />
      ),
      document.getElementById('popup-root')
    );
  }
});
