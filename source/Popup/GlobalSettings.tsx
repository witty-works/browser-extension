import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Toggle from '../shared/components/Toggle/Toggle';
import { StorageKeys, Colors } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

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
  }>({
    orthography: true,
    inclusive: true,
    style: true,
  });

  const { t } = useTranslation(namespaces.pages.popup);
  const log = useLog('Popup');

  useEffect(() => {
    let isMounted = true;
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
      {page == 'popup' ? (
        <hr className='toggle-seperator' />
      ) : (
        <div className='wittyworks-options-content-section-content-subtitle'>
          {t('inclusiveLanguageExplanation')}
        </div>
      )}
    </>
  );
};

export default GlobalSettings;
