import React from 'react';
import { browser } from 'webextension-polyfill-ts';
import ApiSelector from './ApiSelector';
import { DEV_ENV } from '../shared/constants';
import EnableWitty from './EnableWitty';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import Settings from '../assets/icons/popup/settings.svg';
import Logo from '../assets/icons/witty-logo-color.svg';
import GlobalSettings from './GlobalSettings';
import './styles.scss';
import DelaySelector from './DelaySelector';

const Popup: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);

  return (
    <>
      <header>
        <Logo
          onClick={() => {
            browser.tabs.create({ url: 'https://www.witty.works/' });
          }}
        />
      </header>
      <section className='wittyworks-toggles'>
        <GlobalSettings />
        <h2>{t('settings')}</h2>
        <EnableWitty />
      </section>
      {DEV_ENV ? (
        <>
          <section>
            <h2>{t('developmentSettings')}</h2>
            <ApiSelector />
            <DelaySelector />
          </section>
        </>
      ) : null}
      <footer>
        <Settings onClick={() => browser.runtime.openOptionsPage()} />
      </footer>
    </>
  );
};

export default Popup;
