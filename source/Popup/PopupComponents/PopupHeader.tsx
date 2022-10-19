import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import Settings from '../../assets/icons/popup/settings.svg';
import Logo from '../../assets/icons/witty-logo-color.svg';
import { getBaseUrls } from '../../shared/ApiServices/requests';

import '../styles.scss';

interface PopupHeaderProps {
  showSettings?: boolean;
}

const PopupHeader: React.FC<PopupHeaderProps> = ({
  showSettings = true,
}: PopupHeaderProps) => {
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
            onClick={() => window.open(getBaseUrls().dashboard, '_blank')}
          />
        )}
      </header>
      <div className='witty-works-ext-separator' />
    </>
  );
};

export default PopupHeader;
