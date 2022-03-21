import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Toggle from '../shared/components/Toggle/Toggle';
import { StorageKeys, Colors } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';

import './styles.scss';

const EnableWitty: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(defaultConfig.APP_ENABLED);
  const { t } = useTranslation(namespaces.pages.popup);
  const log = useLog('Popup');

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.APP_ENABLED)
      .then((result) => {
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
      <Toggle
        on={enabled}
        handleToggle={() => setEnabled(!enabled)}
        color={Colors.green}
        scale={0.35}
        label={t('enableWitty')}
      />
    </>
  );
};

export default EnableWitty;
