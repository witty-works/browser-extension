import * as React from 'react';
import ReactDOM from 'react-dom';
import defaultConfig from '../witty.config.json';
import PopupDomainDeactivated from './PopupDomainDeactivated';
import Popup from './Popup';
import { browser } from 'webextension-polyfill-ts';
import { getDomainWithoutSubdomain } from '../shared/utils';

browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs.length === 0 || !tabs[0].url)
    //Empty tab
    ReactDOM.render(
      <PopupDomainDeactivated />,
      document.getElementById('popup-root')
    );
  else {
    const domain = getDomainWithoutSubdomain(tabs[0].url);
    ReactDOM.render(
      defaultConfig.ACTIVE_SITES.includes(domain) ? (
        <Popup />
      ) : (
        <PopupDomainDeactivated />
      ),
      document.getElementById('popup-root')
    );
  }
});
