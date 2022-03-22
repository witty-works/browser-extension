import React from 'react';
import { browser } from 'webextension-polyfill-ts';
import ApiSelector from './ApiSelector';
import { DEV_ENV } from '../shared/constants';
import GlobalSettings from './GlobalSettings';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import Logo from '../assets/icons/witty-logo-color.svg';
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
      <section>
        <GlobalSettings />
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
