import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Toggle from '../shared/components/Toggle/Toggle';
import { StorageKeys, Colors } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

import './styles.scss';

const GlobalSettings: React.FC = () => {
  const [toggleState, setToggleState] = useState<{
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
      .get(StorageKeys.TOGGLE_STATE)
      .then((result) => {
        setToggleState(result[StorageKeys.TOGGLE_STATE]);
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    const falsyKeys = Object.keys(toggleState).filter(
      (key) => !toggleState[key as keyof typeof toggleState]
    );

    storeInLocalStorage(StorageKeys.DISABLED_CATEGORIES, falsyKeys);
    storeInLocalStorage(StorageKeys.TOGGLE_STATE, toggleState);
  }, [toggleState]);

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
        on={toggleState.orthography}
        handleToggle={() => {
          setToggleState({
            ...toggleState,
            orthography: !toggleState.orthography,
          });
        }}
        color={Colors.green}
        scale={0.35}
        label={t('spellChecking')}
      />
      <Toggle
        on={toggleState.inclusive}
        handleToggle={() => {
          setToggleState({
            ...toggleState,
            inclusive: !toggleState.inclusive,
          });
        }}
        color={Colors.green}
        scale={0.35}
        label={t('inclusiveTerms')}
      />
      <Toggle
        on={toggleState.style}
        handleToggle={() => {
          setToggleState({
            ...toggleState,
            style: !toggleState.style,
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
