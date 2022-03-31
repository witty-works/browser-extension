import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Toggle from '../shared/components/Toggle/Toggle';
import {
  StorageKeys,
  Colors,
  WittyIconActive,
  WittyIconInactive,
} from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import defaultConfig from '../witty.config.json';

import './styles.scss';

const EnableWitty: React.FC = () => {
  const [disabledSites, setDisabledSites] = useState(
    defaultConfig.DISABLED_SITES
  );
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const { t } = useTranslation(namespaces.pages.popup);
  const log = useLog('Popup');

  useEffect(() => {
    let isMounted = true;
    browser.storage.local
      .get(StorageKeys.DISABLED_SITES)
      .then((result) => {
        if (!isMounted) return;
        setDisabledSites(result[StorageKeys.DISABLED_SITES] || []);
      })
      .catch(onError);

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      var tab = tabs[0];
      if (!tab.url) return;
      setCurrentDomain(new URL(tab.url).hostname.replace('www.', ''));

      disabledSites.includes(currentDomain as never)
        ? setIsEnabled(false)
        : setIsEnabled(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    browser.storage.local.get(StorageKeys.DISABLED_SITES).then((result) => {
      const disabledSites = result[StorageKeys.DISABLED_SITES]
        ? result[StorageKeys.DISABLED_SITES]
        : [];

      const newDisabledSites = isEnabled
        ? disabledSites.filter((domain: string) => domain !== currentDomain)
        : disabledSites.includes(currentDomain)
        ? disabledSites
        : [...disabledSites, currentDomain];
      browser.storage.local
        .set({ [StorageKeys.DISABLED_SITES]: newDisabledSites })
        .then(() => {
          log(
            `Witty ${StorageKeys.DISABLED_SITES} *${newDisabledSites}* correctly saved`
          );
        })
        .catch(onError);
    });
    const icon = isEnabled ? WittyIconActive : WittyIconInactive;
    browser.browserAction.setIcon(icon);
  }, [isEnabled]);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  return (
    <>
      <Toggle
        on={isEnabled}
        handleToggle={() => setIsEnabled(!isEnabled)}
        color={Colors.green}
        scale={0.35}
        label={t('enableWitty')}
      />
    </>
  );
};

export default EnableWitty;
