import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import Settings from '../../assets/icons/popup/settings.svg';
import Logo from '../../assets/icons/witty-logo-color.svg';
import { getBaseUrls } from '../../shared/ApiServices/requests';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';

import '../styles.scss';

interface PopupHeaderProps {
  showSettings?: boolean;
  appId: string;
}

const PopupHeader: React.FC<PopupHeaderProps> = ({
  showSettings = true,
  appId,
}: PopupHeaderProps) => {
  const analytics = useAnalytics();

  return (
    <>
      <header className='witty-works-ext-header'>
        <Logo
          id='witty-logo'
          onClick={() => {
            browser.tabs.create({ url: 'https://www.witty.works/' });
          }}
        />
        {showSettings && (
          <Settings
            id='witty-settings'
            onClick={() => {
              analytics.dashboardLog('popup', appId);
              window.open(
                getBaseUrls().dashboard + 'user/language/language-settings',
                '_blank'
              );
            }}
          />
        )}
      </header>
      <div className='witty-works-ext-separator' />
    </>
  );
};

export default PopupHeader;
