import React from 'react';
import ReactDOM from 'react-dom';
import Popup from './Popups/Popup';
import PopupDomainDeactivated from './Popups/PopupDomainDeactivated';
import PopupLogin from './Popups/PopupLogin';
import defaultConfig from '../witty.config.json';
import { isMicrosoftOnline } from '../shared/DOMutils';

export const renderUserNotLoggedIn = () => {
  ReactDOM.render(
    <PopupLogin />,
    document.getElementById('witty-works-ext-popup-root')
  );
};

export const renderDomainDeactivated = (appId: string, domain: string) => {
  ReactDOM.render(
    <PopupDomainDeactivated appId={appId} domain={domain} />,
    document.getElementById('witty-works-ext-popup-root')
  );
};

export const renderMainPopup = (
  appId: string,
  domain: string,
  isLocked: boolean
) => {
  ReactDOM.render(
    <Popup
      appId={appId}
      domain={domain}
      isLocked={isLocked}
    />,
    document.getElementById('witty-works-ext-popup-root')
  );
};

export const renderPopupChrome = (
  appId: string,
  domain: string,
  currentWindowUrl: string | undefined,
  isLocked: boolean
) => {
  if (defaultConfig.DISABLED_SITES.includes(domain) || isMicrosoftOnline(currentWindowUrl)) {
    renderDomainDeactivated(appId, domain);
  } else {
    renderMainPopup(
      appId,
      domain,
      isLocked
    );
  }
};
