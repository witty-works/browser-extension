import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Toggle from '../shared/components/Toggle/Toggle';
import { StorageKeys, Colors } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

import './styles.scss';

const GlobalSettings: React.FC = () => {
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
    browser.storage.local
      .get(StorageKeys.GLOBAL_SETTINGS)
      .then((result) => {
        setGlobalSettings(result[StorageKeys.GLOBAL_SETTINGS]);
      })
      .catch(onError);
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
      <h2 className='wittyworks-toggle-title'>{t('globalSettings')}</h2>
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
    </>
  );
};

export default GlobalSettings;
