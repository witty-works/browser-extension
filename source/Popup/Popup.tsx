import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';

import ApiSelector from './ApiSelector';
import LanguageSelector from './LanguageSelector';
import Toggle from '../shared/components/Toggle/Toggle';
import { DEV_ENV, StorageKeys, Colors } from '../shared/constants';
import PreferredLanguagesSelector from './PreferedLanguagesSelector';
import GermanGenderEndSelector from './GermanGenderEndSelector';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

import './styles.scss';

const Popup: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);
  const { t } = useTranslation(namespaces.pages.popup);
  const log = useLog('Popup');

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.APP_ENABLED)
      .then((result) => {
        if (result[StorageKeys.APP_ENABLED])
          setEnabled(result[StorageKeys.APP_ENABLED]);
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    //Save app status on the local storage
    browser.storage.local
      .set({ [StorageKeys.APP_ENABLED]: enabled })
      .then(() => {
        log(
          `Witty status *${enabled ? 'enabled' : 'disabled'}* correctly saved`
        );
      })
      .catch(onError);

    //Change app icon acordingly
    enabled
      ? browser.browserAction.setIcon({
          path: {
            '16': 'assets/icons/icon16.png',
            '32': 'assets/icons/icon32.png',
            '48': 'assets/icons/icon48.png',
          },
        })
      : browser.browserAction.setIcon({
          path: {
            '16': 'assets/icons/icon16_disabled.png',
            '32': 'assets/icons/icon32_disabled.png',
            '48': 'assets/icons/icon48_disabled.png',
          },
        });
  }, [enabled]);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  return (
    <>
      <header>
        <h1>
          <a href='https://www.witty.works/' target='_blank'>
            <img
              className='icon'
              alt='Witty Works Logo'
              width='100'
              height='15'
              src={browser.runtime.getURL(
                '../assets/icons/witty-logo-color.svg'
              )}
            />
          </a>
        </h1>
      </header>
      <hr></hr>
      <section>
        <h2>{t('settings')}</h2>
        <Toggle
          on={enabled}
          handleToggle={() => setEnabled(!enabled)}
          color={Colors.green}
          scale={0.35}
          label={t('enableWitty')}
        />
        <LanguageSelector />
        <PreferredLanguagesSelector />
        <GermanGenderEndSelector />
      </section>
      {DEV_ENV ? (
        <>
          <hr></hr>
          <section>
            <h2>{t('developmentSettings')}</h2>
            <ApiSelector />
          </section>
        </>
      ) : null}
      <footer>
        <a href='https://www.witty.works/help' target='_blank'>
          {t('needHelpQuestionMark')}
        </a>
      </footer>
    </>
  );
};

export default Popup;
