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

export const renderDomainDeactivated = (appId: string, domain: string) => {
  ReactDOM.render(
    <PopupDomainDeactivated appId={appId} domain={domain} />,
    document.getElementById('popup-root')
  );
};

export const renderMainPopup = (
  appId: string,
  domain: string,
  hasWittyTeams: boolean,
  domainOnActiveOrDisabledList: boolean,
  domainIsConfirmedByUser: boolean,
  domainsConfirmedToNotWork: string[],
  domainsConfirmedToWork: string[]
) => {
  ReactDOM.render(
    <Popup
      appId={appId}
      domain={domain}
      hasWittyTeams={hasWittyTeams}
      domainOnActiveOrDisabledList={domainOnActiveOrDisabledList}
      domainIsConfirmedByUser={domainIsConfirmedByUser}
      domainsConfirmedToNotWork={domainsConfirmedToNotWork}
      domainsConfirmedToWork={domainsConfirmedToWork}
    />,
    document.getElementById('popup-root')
  );
};

export const renderDomainOnListPopup = (listType: string) => {
  ReactDOM.render(
    <PopupDomainOnList listType={listType} />,
    document.getElementById('popup-root')
  );
};

export const renderPopupChrome = (
  appId: string,
  domain: string,
  hasWittyTeams: boolean,
  domainOnActiveOrDisabledList: boolean,
  domainIsConfirmedByUser: boolean,
  domainsConfirmedToNotWork: string[],
  domainsConfrimedToWork: string[],
  result: any
) => {
  if (
    (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
      result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
    (result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
      !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain))
  ) {
    renderDomainOnListPopup(result[StorageKeys.ORGANIZATION_DOMAINS].type);
  } else if (
    (!defaultConfig.ACTIVE_SITES.includes(domain) &&
      !defaultConfig.DISABLED_SITES.includes(domain)) ||
    defaultConfig.ACTIVE_SITES.includes(domain)
  ) {
    renderMainPopup(
      appId,
      domain,
      hasWittyTeams,
      domainOnActiveOrDisabledList,
      domainIsConfirmedByUser,
      domainsConfirmedToNotWork,
      domainsConfrimedToWork
    );
  } else {
    renderDomainDeactivated(appId, domain);
  }
};
