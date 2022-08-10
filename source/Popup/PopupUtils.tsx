import React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys } from '../shared/constants';
import { logTypes, useLog } from '../shared/customHooks/useLog';
import { sendErrorToSentry } from '../shared/errorUtils';
import Popup from './Popups/Popup';
import PopupDomainDeactivated from './Popups/PopupDomainDeactivated';
import PopupDomainOnList from './Popups/PopupDomainOnList';
import PopupLogin from './Popups/PopupLogin';

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

const log = useLog('Popup');

export const onStorageError = (error: unknown) => {
  log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  sendErrorToSentry(error);
};

export const onTabsQueryError = (error: unknown) => {
  log(`onTabsQueryError Error: ${error}`, logTypes.ERROR);
  sendErrorToSentry(error);
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

export const onError = (error: unknown) => {
  log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  sendErrorToSentry(error);
};

export const handleDropdownChange = (value: string) => {
  browser.storage.local
    .set({ [StorageKeys.API_DELAY]: value })
    .then(() => {
      log(`Witty ${StorageKeys.API_DELAY} *${value}* correctly saved`);
    })
    .catch(onError);
};
