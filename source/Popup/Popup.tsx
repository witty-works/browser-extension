import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { ConfigProperty } from '../shared/types';
import {
  StorageKeys,
  Colors,
  WittyIconActive,
  WittyIconInactive,
  DefaultBaseUrlKey,
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
import { getBaseUrls, setBaseUrls } from '../shared/ApiServices/requests';

const Popup: React.FC = () => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const log = useLog('Popup');

  const [enabled, setEnabled] = useState<boolean>(true);
  const [disabledSites, setDisabledSites] = useState<string[]>(
    defaultConfig.DISABLED_SITES
  );
  const [orthography, setOrthography] = useState<ConfigProperty>(
    defaultConfig.ORTHOGRAPHY
  );
  const [inclusiveLanguage, setInclusiveLanguage] = useState<ConfigProperty>(
    defaultConfig.INCLUSIVE
  );
  const [styleCorrections, setStyleCorrections] = useState<ConfigProperty>(
    defaultConfig.STYLE
  );
  const [casing, setCasing] = useState<boolean>(true);
  const [casingSites, setCasingSites] = useState<string[]>(
    defaultConfig.CASING_SITES
  );
  const [hasWittyTeams, setHasWittyTeams] = useState<boolean>(false);
  const [showBackToRecomendedSites, setShowBackToRecomendedSites] =
    useState<boolean>(false);
  const [userIsLoggedIn, setUserIsLoggedIn] = useState<boolean>(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        setOrthography(result[StorageKeys.ORTHOGRAPHY]);
        setInclusiveLanguage(result[StorageKeys.INCLUSIVE]);
        setStyleCorrections(result[StorageKeys.STYLE]);
        setDisabledSites(result[StorageKeys.DISABLED_SITES]);
        setCasingSites(result[StorageKeys.CASING_SITES]);
        result[StorageKeys.PLAN] == 'witty_teams'
          ? setHasWittyTeams(true)
          : setHasWittyTeams(false);

        browser.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            if (tabs.length > 0 && tabs[0].url)
              setCurrentDomain(
                new URL(tabs[0].url).hostname.replace('www.', '')
              );

            !defaultConfig.ACTIVE_SITES.includes(currentDomain) &&
              setShowBackToRecomendedSites(true);

            result[StorageKeys.ACCESS_TOKEN] == ''
              ? setUserIsLoggedIn(false)
              : setUserIsLoggedIn(true);

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
    storeInLocalStorage(StorageKeys.ORTHOGRAPHY, orthography);
  }, [orthography]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.INCLUSIVE, inclusiveLanguage);
  }, [inclusiveLanguage]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.STYLE, styleCorrections);
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

    if (currentDomain.length > 0)
      setDisabledSites(
        enabled
          ? [...disabledSites, currentDomain]
          : disabledSites.filter((item: string) => item !== currentDomain)
      );
  };

  const handleCasingToggle = () => {
    setCasing(!casing);

    if (currentDomain.length > 0)
      setCasingSites(
        casing
          ? [...casingSites, currentDomain]
          : casingSites.filter((item: string) => item !== currentDomain)
      );
  };

  return (
    <>
      <header>
        <Logo
          onClick={() => {
            browser.tabs.create({ url: 'https://www.witty.works/' });
          }}
        />
        <Settings
          onClick={
            //Is necessary to explicitly close the popup in Firefox. In Chrome is the default behaviour
            () => browser.runtime.openOptionsPage().then(() => window.close())
          }
        />
      </header>
      <section className='wittyworks-toggles website-settings'>
        <h2>{t('websiteSettings', { domain: currentDomain })}</h2>
        <Toggle
          on={enabled}
          handleToggle={handleEnableToggle}
          color={Colors.green}
          scale={0.35}
          label={t('enableWitty')}
        />
        <hr className='toggle-separator' />
        {enabled && (
          <>
            <Toggle
              on={casing}
              handleToggle={handleCasingToggle}
              color={Colors.green}
              scale={0.35}
              label={t('caseSensitivity')}
            />
            <hr className='toggle-separator' />
          </>
        )}
      </section>
      {enabled && (
        <section className='wittyworks-toggles global-settings'>
          <h2>{t('globalSettings')}</h2>
          <Toggle
            on={orthography.value as boolean}
            handleToggle={() => {
              setOrthography({
                ...orthography,
                value:
                  orthography.status != 'force'
                    ? !orthography.value
                    : orthography.value,
              });
            }}
            color={Colors.green}
            scale={0.35}
            label={t('spellChecking')}
            locked={orthography.status == 'force'}
            userIsLoggedIn={userIsLoggedIn}
          />

          <hr className='toggle-separator' />
          <Toggle
            on={inclusiveLanguage.value as boolean}
            handleToggle={() => {
              setInclusiveLanguage({
                ...inclusiveLanguage,
                value:
                  inclusiveLanguage.status != 'force'
                    ? !inclusiveLanguage.value
                    : inclusiveLanguage.value,
              });
            }}
            color={Colors.green}
            scale={0.35}
            label={t('inclusiveTerms')}
            locked={inclusiveLanguage.status === 'force'}
            userIsLoggedIn={userIsLoggedIn}
          />
          <hr className='toggle-separator' />
          <Toggle
            on={styleCorrections.value as boolean}
            handleToggle={() => {
              setStyleCorrections({
                ...styleCorrections,
                value:
                  styleCorrections.status != 'force'
                    ? !styleCorrections.value
                    : styleCorrections.value,
              });
            }}
            color={Colors.green}
            scale={0.35}
            label={t('styleCorrections')}
            locked={styleCorrections.status == 'force'}
            userIsLoggedIn={userIsLoggedIn}
          />
          <hr className='toggle-separator' />
          {hasWittyTeams ? (
            <div className='wittyworks-dashboard-button-container'>
              <div
                className='wittyworks-dashboard-button'
                onClick={() => {
                  window.open(getBaseUrls().dashboard, '_blank');
                }}
              >
                {t('goToDashboard')}
              </div>
            </div>
          ) : (
            <div className='wittyworks-upgrade-banner-popup'>
              <div className='wittyworks-upgrade-banner-popup-text-container'>
                <div className='wittyworks-upgrade-banner-popup-title'>
                  {t('getMoreTitle', { domain: 'miro.com' })}
                </div>
                <div className='wittyworks-upgrade-banner-popup-text'>
                  {t('getMoreText')}
                </div>
              </div>
              <div
                className='wittyworks-upgrade-banner-popup-button'
                onClick={() => {
                  window.open(
                    'https://www.witty.works/witty-for-teams',
                    '_blank'
                  );
                }}
              >
                {t('learnMoreButton')}
              </div>
            </div>
          )}
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
        <div
          className='enable-witty'
          onClick={() => {
            storeInLocalStorage(StorageKeys.ENABLE_WITTY_EVERYWHERE, false);
          }}
        >
          {showBackToRecomendedSites && (
            <>
              <span>{t('backToRecomendedSites')}</span>
            </>
          )}
        </div>
      </footer>
    </>
  );
};

export default Popup;
