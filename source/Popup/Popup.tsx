import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';

import {
  StorageKeys,
  Colors,
  WittyIconActive,
  WittyIconInactive,
} from '../shared/constants';
import { DEV_ENV } from '../shared/constants';
import { storeInLocalStorage } from '../shared/utils';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import Toggle from '../shared/components/Toggle/Toggle';
import ApiSelector from './ApiSelector';
import DelaySelector from './DelaySelector';
import Settings from '../assets/icons/popup/settings.svg';
import Logo from '../assets/icons/witty-logo-color.svg';
import defaultConfig from '../witty.config.json';
import './styles.scss';

const Popup: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);
  const log = useLog('Popup');

  const [enabled, setEnabled] = useState<boolean>(true);
  const [disabledSites, setDisabledSites] = useState<string[]>(
    defaultConfig.DISABLED_SITES
  );
  const [spellChecking, setSpellChecking] = useState<boolean>(
    defaultConfig.SPELL_CHECKING
  );
  const [inclusiveLanguage, setInclusiveLanguage] = useState<boolean>(
    defaultConfig.INCLUSIVE_LANGUAGE
  );
  const [styleCorrections, setStyleCorrections] = useState<boolean>(
    defaultConfig.STYLE_CORRECTIONS
  );
  const [casing, setCasing] = useState<boolean>(true);
  const [casingSites, setCasingSites] = useState<string[]>(
    defaultConfig.CASING_SITES
  );

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setSpellChecking(result[StorageKeys.SPELL_CHECKING]);
        setInclusiveLanguage(result[StorageKeys.INCLUSIVE_LANGUAGE]);
        setStyleCorrections(result[StorageKeys.STYLE_CORRECTIONS]);

        setDisabledSites(result[StorageKeys.DISABLED_SITES]);
        setCasingSites(result[StorageKeys.CASING_SITES]);

        browser.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            if (tabs.length === 0 || !tabs[0].url) return;
            const currentDomain = new URL(tabs[0].url).hostname.replace(
              'www.',
              ''
            );
            if (
              result[StorageKeys.DISABLED_SITES] &&
              result[StorageKeys.DISABLED_SITES].includes(currentDomain)
            )
              setEnabled(false);

            if (
              result[StorageKeys.CASING_SITES] &&
              result[StorageKeys.CASING_SITES].includes(currentDomain)
            )
              setCasing(false);
          })
          .catch(onTabsQueryError);
      })
      .catch(onStorageError);
  }, []);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.DISABLED_SITES, disabledSites);
  }, [disabledSites.length]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.CASING_SITES, casingSites);
  }, [casingSites.length]);

  useEffect(() => {
    setWittyIcon(enabled);
  }, [enabled]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.SPELL_CHECKING, spellChecking);
  }, [spellChecking]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.INCLUSIVE_LANGUAGE, inclusiveLanguage);
  }, [inclusiveLanguage]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.STYLE_CORRECTIONS, styleCorrections);
  }, [styleCorrections]);

  const onStorageError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const onTabsQueryError = (error: string) => {
    log(`onTabsQueryError Error: ${error}`, logTypes.ERROR);
  };

  const setWittyIcon = (state: boolean) => {
    browser.browserAction.setIcon(state ? WittyIconActive : WittyIconInactive);
  };

  const handleEnableToggle = () => {
    setEnabled(!enabled);
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs.length === 0 || !tabs[0].url) return;
        const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');

        setDisabledSites(
          enabled
            ? [...disabledSites, currentDomain]
            : disabledSites.filter((item: string) => item !== currentDomain)
        );
      })
      .catch(onTabsQueryError);
  };

  const handleCasingToggle = () => {
    setCasing(!casing);
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs.length === 0 || !tabs[0].url) return;
        const currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');

        setCasingSites(
          casing
            ? [...casingSites, currentDomain]
            : casingSites.filter((item: string) => item !== currentDomain)
        );
      })
      .catch(onTabsQueryError);
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
        <Toggle
          on={enabled}
          handleToggle={handleEnableToggle}
          color={Colors.green}
          scale={0.35}
          label={t('enableWitty')}
        />
        <hr className='toggle-separator' />
      </section>
      {enabled && (
        <section className='wittyworks-toggles global-settings'>
          <h2>{t('globalSettings')}</h2>
          <Toggle
            on={spellChecking}
            handleToggle={() => {
              setSpellChecking(!spellChecking);
            }}
            color={Colors.green}
            scale={0.35}
            label={t('spellChecking')}
          />
          <hr className='toggle-separator' />
          <Toggle
            on={inclusiveLanguage}
            handleToggle={() => {
              setInclusiveLanguage(!inclusiveLanguage);
            }}
            color={Colors.green}
            scale={0.35}
            label={t('inclusiveTerms')}
          />
          <hr className='toggle-separator' />
          <Toggle
            on={styleCorrections}
            handleToggle={() => {
              setStyleCorrections(!styleCorrections);
            }}
            color={Colors.green}
            scale={0.35}
            label={t('styleCorrections')}
          />
          <hr className='toggle-separator' />
        </section>
      )}
      {enabled && (
        <section className='wittyworks-toggles website-settings'>
          <h2>{t('websiteSettings')}</h2>
          <Toggle
            on={casing}
            handleToggle={handleCasingToggle}
            color={Colors.green}
            scale={0.35}
            label={t('caseSensitivity')}
          />
          <hr className='toggle-separator' />
        </section>
      )}
      {DEV_ENV && (
        <section>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
        </section>
      )}
      <footer>
        <Settings onClick={() => browser.runtime.openOptionsPage()} />
      </footer>
    </>
  );
};

export default Popup;
