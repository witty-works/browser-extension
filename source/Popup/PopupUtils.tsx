import React from 'react';
import ReactDOM from 'react-dom';
import { browser } from 'webextension-polyfill-ts';
import { BaseUrls, StorageKeys } from '../shared/constants';
import Popup from './Popups/Popup';
import PopupDomainDeactivated from './Popups/PopupDomainDeactivated';
import PopupLogin from './Popups/PopupLogin';
import defaultConfig from '../witty.config.json';
import { getBaseUrls } from '../shared/ApiServices/requests';

export const logIn = async (urls: string) => {
  const optionsPageUrl = browser.extension.getURL('options.html');

  browser.storage.local.get(null).then((result) => {
    if (!result[StorageKeys.REDIRECT_URL_LOGIN]) {
      const url = `${BaseUrls[urls].dashboard}api/browser-login?redirect_uri=${optionsPageUrl}?target=https://www.witty.works/try-out-witty`;
      window.open(url, '_blank');
    } else {
      const url = `${
        BaseUrls[urls].dashboard
      }api/browser-login?redirect_uri=${optionsPageUrl}?target=${
        getBaseUrls().dashboard
      }`;
      window.open(url, '_blank');
    }
  });
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
  domainOnActiveOrDisabledList: boolean,
  domainIsConfirmedByUser: boolean,
  domainsConfirmedToNotWork: string[],
  domainsConfirmedToWork: string[],
  isLocked: boolean
) => {
  ReactDOM.render(
    <Popup
      appId={appId}
      domain={domain}
      domainOnActiveOrDisabledList={domainOnActiveOrDisabledList}
      domainIsConfirmedByUser={domainIsConfirmedByUser}
      domainsConfirmedToNotWork={domainsConfirmedToNotWork}
      domainsConfirmedToWork={domainsConfirmedToWork}
      isLocked={isLocked}
    />,
    document.getElementById('popup-root')
  );
};

export const renderPopupChrome = (
  appId: string,
  domain: string,
  domainOnActiveOrDisabledList: boolean,
  domainIsConfirmedByUser: boolean,
  domainsConfirmedToNotWork: string[],
  domainsConfrimedToWork: string[],
  result: any
) => {
  const isLocked =
    (result[StorageKeys.ORGANIZATION_DOMAINS] &&
      result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
      result[StorageKeys.ORGANIZATION_DOMAINS].list &&
      result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
    (result[StorageKeys.ORGANIZATION_DOMAINS] &&
      result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
      result[StorageKeys.ORGANIZATION_DOMAINS].list &&
      !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain));

  if (defaultConfig.DISABLED_SITES.includes(domain)) {
    renderDomainDeactivated(appId, domain);
  } else {
    renderMainPopup(
      appId,
      domain,
      domainOnActiveOrDisabledList,
      domainIsConfirmedByUser,
      domainsConfirmedToNotWork,
      domainsConfrimedToWork,
      isLocked
    );
  }
};
