import React from 'react';
import browser from 'webextension-polyfill';
import {useTranslation} from 'react-i18next';

import {namespaces} from '../../i18n/i18n.constants';
import '../../i18n/i18n';

/**
 * Opens the extension's own options page.
 *
 * Deliberately shown when signed out as well as signed in: pointing Witty at a
 * self-hosted server, or entering an API key, has to happen *before* sign-in is
 * possible. Until this existed the page was only reachable via
 * chrome://extensions → Details → Extension options, which made a shipped
 * feature effectively undiscoverable.
 */
const OptionsLink: React.FC = () => {
  const {t} = useTranslation([namespaces.pages.popup]);

  return (
    <div className='witty-works-ext-section witty-works-ext-left'>
      <span
        id='witty-options-link'
        className='witty-works-ext-lato-popup-text-purple witty-works-ext-cursor-pointer'
        role='button'
        tabIndex={0}
        onClick={() => browser.runtime.openOptionsPage()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            browser.runtime.openOptionsPage();
          }
        }}
      >
        {t('extensionSettings')}
      </span>
      <div className='witty-works-ext-lato-popover-text-gray'>
        {t('extensionSettingsHint')}
      </div>
    </div>
  );
};

export default OptionsLink;
