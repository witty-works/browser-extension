import React from 'react';
import browser from 'webextension-polyfill';

import SettingsWithNotification from '../../assets/icons/popup/settingsWithNotification.svg';
import Logo from '../../assets/icons/witty-logo-color.svg';
import {getBaseUrls} from '../../shared/ApiServices/requests';

import '../styles.scss';

const PopupHeaderNotification: React.FC = () => (
  <header className='witty-works-ext-header'>
    <Logo
      id='witty-logo'
      onClick={() => {
        browser.tabs.create({url: 'https://www.witty.works/'});
      }}
    />
    <SettingsWithNotification
      id='witty-settings'
      onClick={() =>
        window.open(getBaseUrls().dashboard + 'user/language', '_blank')
      }
    />
  </header>
);

export default PopupHeaderNotification;
