import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import SettingsWithNotification from '../../assets/icons/popup/settingsWithNotification.svg';
import Logo from '../../assets/icons/witty-logo-color.svg';
import { getBaseUrls } from '../../shared/ApiServices/requests';

import '../styles.scss';

const PopupHeaderNotification: React.FC = () => {
  return (
    <header className='witty-works-ext-header'>
      <Logo
        id='witty-logo'
        onClick={() => {
          browser.tabs.create({ url: 'https://www.witty.works/' });
        }}
      />
      <SettingsWithNotification
        id='witty-settings'
        onClick={() =>
          window.open(
            getBaseUrls().dashboard + 'user/language/language-settings',
            '_blank'
          )
        }
      />
    </header>
  );
};

export default PopupHeaderNotification;
