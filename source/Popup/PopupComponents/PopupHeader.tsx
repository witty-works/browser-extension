import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import Settings from '../../assets/icons/popup/settings.svg';
import SettingsWithNotification from '../../assets/icons/popup/settingsWithNotification.svg';
import Logo from '../../assets/icons/witty-logo-color.svg';
import { getBaseUrls } from '../../shared/ApiServices/requests';

import '../styles.scss';

interface PopupHeaderProps {
  hasNotificationBadge?: boolean;
}

const PopupHeader: React.FC<PopupHeaderProps> = ({
  hasNotificationBadge = false,
}: PopupHeaderProps) => {
  return (
    <header>
      <Logo
        id='witty-logo'
        onClick={() => {
          browser.tabs.create({ url: 'https://www.witty.works/' });
        }}
      />
      {hasNotificationBadge ? (
        <SettingsWithNotification
          id='witty-settings'
          onClick={() => window.open(getBaseUrls().dashboard, '_blank')}
        />
      ) : (
        <Settings
          id='witty-settings'
          onClick={() => window.open(getBaseUrls().dashboard, '_blank')}
        />
      )}
    </header>
  );
};

export default PopupHeader;
