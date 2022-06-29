import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import Settings from '../assets/icons/popup/settings.svg';
import Logo from '../assets/icons/witty-logo-color.svg';

import './styles.scss';

const PopupHeader: React.FC = () => {
  return (
    <header>
      <Logo
        id='witty-logo'
        onClick={() => {
          browser.tabs.create({ url: 'https://www.witty.works/' });
        }}
      />
      <Settings
        id='witty-settings'
        onClick={
          //Is necessary to explicitly close the popup in Firefox. In Chrome is the default behaviour
          () => browser.runtime.openOptionsPage().then(() => window.close())
        }
      />
    </header>
  );
};

export default PopupHeader;
