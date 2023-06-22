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
}: PopupHeaderProps) => {
  const analytics = useAnalytics();

  function handleClickLogo() {
    browser.tabs.create({ url: 'https://www.witty.works/' });
  }

  function handleClickSettings() {
    analytics.dashboardLog('cogwheel_popup');
    window.open(
      getBaseUrls().dashboard + 'user/language',
      '_blank'
    );
  }

  return (
    <>
      <header className='witty-works-ext-header'>
        <Logo id='witty-logo' onClick={handleClickLogo} />
        {showSettings && (
          <Settings id='witty-settings' onClick={handleClickSettings} />
        )}
      </header>
      <div className='witty-works-ext-separator' />
    </>
  );
};

export default PopupHeader;
