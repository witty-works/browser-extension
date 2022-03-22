import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Toggle from '../shared/components/Toggle/Toggle';
import { StorageKeys, Colors } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';

import './styles.scss';
interface GlobalSettingsProps {
  page: string;
}
const GlobalSettings: React.FC<GlobalSettingsProps> = ({
  page,
}: GlobalSettingsProps) => {
  const [globalSettings, setGlobalSettings] = useState<{
    orthography: boolean;
    inclusive: boolean;
    style: boolean;
    casing: boolean;
  }>({
    orthography: true,
    inclusive: true,
    style: true,
    casing: true,
  });
  const [enabled, setEnabled] = useState<boolean>(defaultConfig.APP_ENABLED);

  const { t } = useTranslation(namespaces.pages.popup);
  const log = useLog('Popup');

  useEffect(() => {
    let isMounted = true;
    browser.storage.local
      .get(StorageKeys.APP_ENABLED)
      .then((result) => {
        setEnabled(result[StorageKeys.APP_ENABLED]);
      })
      .catch(onError);

    browser.storage.local
      .get(StorageKeys.GLOBAL_SETTINGS)
      .then((result) => {
        if (result[StorageKeys.GLOBAL_SETTINGS] && isMounted)
          setGlobalSettings(result[StorageKeys.GLOBAL_SETTINGS]);
      })
      .catch(onError);
    return () => {
      isMounted = false;
    };
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

  useEffect(() => {
    storeInLocalStorage(StorageKeys.GLOBAL_SETTINGS, globalSettings);
  }, [globalSettings]);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const storeInLocalStorage = (key: string, value: any) => {
    browser.storage.local
      .set({ [key]: value })
      .then(() => {
        log(`Witty ${key} *${value}* correctly saved`);
      })
      .catch(onError);
  };

  return (
    <>
      <Toggle
        on={globalSettings.orthography}
        handleToggle={() => {
          setGlobalSettings({
            ...globalSettings,
            orthography: !globalSettings.orthography,
          });
        }}
        color={Colors.green}
        scale={0.35}
        label={t('spellChecking')}
      />
      {page == 'popup' ? (
        <hr className='toggle-seperator' />
      ) : (
        <div className='wittyworks-options-content-section-content-subtitle'></div>
      )}
      <Toggle
        on={globalSettings.inclusive}
        handleToggle={() => {
          setGlobalSettings({
            ...globalSettings,
            inclusive: !globalSettings.inclusive,
          });
        }}
        color={Colors.green}
        scale={0.35}
        label={t('inclusiveTerms')}
      />
      {page == 'popup' ? (
        <hr className='toggle-seperator' />
      ) : (
        <div className='wittyworks-options-content-section-content-subtitle'>
          {t('styleCorrectionExplanation')}
        </div>
      )}
      <Toggle
        on={globalSettings.style}
        handleToggle={() => {
          setGlobalSettings({
            ...globalSettings,
            style: !globalSettings.style,
          });
        }}
        color={Colors.green}
        scale={0.35}
        label={t('styleCorrections')}
      />

      <h2 className='wittyworks-toggle-title'>{t('websiteSettings')}</h2>
      <Toggle
        on={enabled}
        handleToggle={() => setEnabled(!enabled)}
        color={Colors.green}
        scale={0.35}
        label={t('enableWitty')}
      />
      <Toggle
        on={globalSettings.casing}
        handleToggle={() =>
          setGlobalSettings({
            ...globalSettings,
            casing: !globalSettings.casing,
          })
        }
        color={Colors.green}
        scale={0.35}
        label={t('caseSensitivity')}
      />
    </>
  );
};

export default GlobalSettings;
