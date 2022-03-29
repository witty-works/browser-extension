import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import ApiSelector from './ApiSelector';
import { DEV_ENV, StorageKeys } from '../shared/constants';
import EnableWitty from './EnableWitty';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import Settings from '../assets/icons/popup/settings.svg';
import Logo from '../assets/icons/witty-logo-color.svg';
import GlobalSettings from './GlobalSettings';
import './styles.scss';
import { logTypes, useLog } from '../shared/customHooks/useLog';
const log = useLog('Popup');

const Popup: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);
  const [delay, setDelay] = useState(3000);

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.API_DELAY)
      .then((result) => {
        setDelay(result[StorageKeys.API_DELAY]);
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    browser.storage.local
      .set({ [StorageKeys.API_DELAY]: delay })
      .then(() => {
        log(`Witty ${StorageKeys.API_DELAY} *${delay}* correctly saved`);
      })
      .catch(onError);
  }, [delay]);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

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
            <select
              value={delay}
              onChange={(e) => {
                setDelay(parseInt(e.target.value, 10));
              }}
            >
              {[...Array(7).keys()].map((i) => (
                <option key={i} value={i * 500}>
                  {i * 500}
                </option>
              ))}
            </select>
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
