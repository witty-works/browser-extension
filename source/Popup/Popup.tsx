import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { useTranslation } from 'react-i18next';

import { ConfigProperty } from '../shared/types';
import {
  StorageKeys,
  Colors,
  DefaultBaseUrlKey,
  DEV_ENV,
} from '../shared/constants';
import {
  addInactiveLabel,
  removeInactiveLabel,
  storeInLocalStorage,
} from '../shared/utils';
import { sendErrorToSentry } from '../shared/errorUtils';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import Toggle from '../shared/components/Toggle/Toggle';
import ApiSelector from './ApiSelector';
import DelaySelector from './DelaySelector';

import defaultConfig from '../witty.config.json';
import './styles.scss';
import {
  getBaseUrls,
  setBaseUrls,
  setToken,
} from '../shared/ApiServices/requests';
import PopupHeader from './PopupHeader';

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
        setUserIsLoggedIn(result[StorageKeys.ACCESS_TOKEN] ? true : false);
        setOrthography(result[StorageKeys.ORTHOGRAPHY]);
        setInclusiveLanguage(result[StorageKeys.INCLUSIVE]);
        setStyleCorrections(result[StorageKeys.STYLE]);
        setDisabledSites(result[StorageKeys.DISABLED_SITES]);
        setCasingSites(result[StorageKeys.CASING_SITES]);
        setHasWittyTeams(
          result[StorageKeys.PLAN] == 'witty_teams' ? true : false
        );
        browser.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            if (tabs.length > 0 && tabs[0].url) {
              let newCurrentDomain = '';
              if (tabs[0].url.includes('https://' || 'http://')) {
                newCurrentDomain = new URL(tabs[0].url).hostname.replace(
                  'www.',
                  ''
                );
              }
              setCurrentDomain(newCurrentDomain);

              defaultConfig.ACTIVE_SITES &&
                !defaultConfig.ACTIVE_SITES.includes(newCurrentDomain) &&
                setShowBackToRecomendedSites(true);

              if (
                result[StorageKeys.DISABLED_SITES] &&
                result[StorageKeys.DISABLED_SITES].includes(newCurrentDomain)
              )
                setEnabled(false);

              if (
                result[StorageKeys.CASING_SITES] &&
                result[StorageKeys.CASING_SITES].includes(newCurrentDomain)
              )
                setCasing(false);
            }
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

  useEffect(() => {
    setEnabled(!userIsLoggedIn ? false : true);
  }, [userIsLoggedIn]);

  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  const onTabsQueryError = (error: unknown) => {
    log(`onTabsQueryError Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  const setWittyIcon = (state: boolean) => {
    state ? removeInactiveLabel() : addInactiveLabel();
  };

  const handleEnableToggle = () => {
    setEnabled(!enabled);

    if (currentDomain && currentDomain.length > 0)
      setDisabledSites(
        enabled
          ? [...disabledSites, currentDomain]
          : disabledSites.filter((item: string) => item !== currentDomain)
      );
  };

  const handleCasingToggle = () => {
    setCasing(!casing);

    if (currentDomain && currentDomain.length > 0)
      setCasingSites(
        casing
          ? [...casingSites, currentDomain]
          : casingSites.filter((item: string) => item !== currentDomain)
      );
  };

  const logOut = () => {
    browser.storage.local.set({ [StorageKeys.ACCESS_TOKEN]: '' });
    setToken('');
    setUserIsLoggedIn(false);
  };

  return (
    <>
      <PopupHeader />
      {currentDomain && currentDomain.length > 0 && (
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
      )}
      {enabled && (
        <section className='wittyworks-toggles global-settings'>
          <h2>{t('globalSettings')}</h2>
          <Toggle
            on={orthography.value as boolean}
            handleToggle={() => {
              setOrthography({
                ...orthography,
                value:
                  orthography.status != 'force' || !userIsLoggedIn
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
                  inclusiveLanguage.status != 'force' || !userIsLoggedIn
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
                  styleCorrections.status != 'force' || !userIsLoggedIn
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
          <div
            className='wittyworks-signin-button'
            onClick={() => {
              logOut();
            }}
          >
            {t('signOut')}
          </div>
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
            <span>{t('backToRecomendedSites')}</span>
          )}
        </div>
      </footer>
    </>
  );
};

export default Popup;
