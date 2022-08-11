import React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys } from '../shared/constants';
import Popup from './Popups/Popup';
import PopupDomainDeactivated from './Popups/PopupDomainDeactivated';
import PopupDomainOnList from './Popups/PopupDomainOnList';
import PopupLogin from './Popups/PopupLogin';
import defaultConfig from '../witty.config.json';

export const logIn = async (urls: string) => {
  const optionsPageUrl =
    'chrome-extension://' + browser.runtime.id + '/options.html';
  const url = `${BaseUrls[urls].dashboard}api/browser-login?redirect_uri=${optionsPageUrl}`;
  window.open(url, '_blank');
};

export const register = async (urls: string) => {
  const url = `${BaseUrls[urls].dashboard}oauth/azureadb2c/register`;
  window.open(url, '_blank');
};

export const renderUserNotLoggedIn = () => {
  ReactDOM.render(<PopupLogin />, document.getElementById('popup-root'));
};

export const renderDomainDeactivated = () => {
  ReactDOM.render(
    <PopupDomainDeactivated />,
    document.getElementById('popup-root')
  );
};

export const renderMainPopup = () => {
  ReactDOM.render(<Popup />, document.getElementById('popup-root'));
};

export const renderDomainOnListPopup = (listType: string) => {
  ReactDOM.render(
    <PopupDomainOnList listType={listType} />,
    document.getElementById('popup-root')
  );
};

export const renderPopupChrome = (domain: string, result: any) => {
  if (
    (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
      result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
    (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
      !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain))
  ) {
    renderDomainOnListPopup(result[StorageKeys.ORGANIZATION_DOMAINS].type);
  } else {
    defaultConfig.ACTIVE_SITES.includes(domain) ||
    result[StorageKeys.ENABLE_WITTY_EVERYWHERE]
      ? renderMainPopup()
      : renderDomainDeactivated();
  }
};
