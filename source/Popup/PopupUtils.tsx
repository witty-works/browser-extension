import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import Popup from './Popups/Popup';
import PopupDomainDeactivated from './Popups/PopupDomainDeactivated';
import PopupLogin from './Popups/PopupLogin';
import defaultConfig from '../witty.config.json';
import { isMicrosoftOnline } from '../shared/DOMutils';

  const container = document.getElementById('witty-works-ext-popup-root');
  let root: null | Root = null;
  if (container) {
    root = createRoot(container);
  }

export const renderUserNotLoggedIn = () => {
  root?.render(<PopupLogin />);
};

export const renderDomainDeactivated = (appId: string, domain: string) => {
  root?.render(<PopupDomainDeactivated appId={appId} domain={domain} />);
};

export const renderMainPopup = (appId: string, domain: string, isLocked: boolean) => {
  root?.render(<Popup appId={appId} domain={domain} isLocked={isLocked} />);
};

export const renderPopupChrome = (
  appId: string,
  domain: string,
  currentWindowUrl: string,
  isLocked: boolean,
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
