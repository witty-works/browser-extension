import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popups/Popup';
import PopupDomainDeactivated from './Popups/PopupDomainDeactivated';
import PopupLogin from './Popups/PopupLogin';
import defaultConfig from '../witty.config.json';
import { isMicrosoftOnline } from '../shared/DOMutils';

export const renderUserNotLoggedIn = () => {
  const container = document.getElementById('witty-works-ext-popup-root');

  if (container) {
    const root = createRoot(container);
      root.render(<PopupLogin />);
  }
};

export const renderDomainDeactivated = (appId: string, domain: string) => {
  const container = document.getElementById('witty-works-ext-popup-root');

  if (container) {
    const root = createRoot(container);
    root.render(<PopupDomainDeactivated appId={appId} domain={domain} />);
  }
};

export const renderMainPopup = (appId: string, domain: string, isLocked: boolean) => {
  const container = document.getElementById('witty-works-ext-popup-root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <Popup
        appId={appId}
        domain={domain}
        isLocked={isLocked}
      />
    );
  }
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
