import React, { useState, useEffect } from 'react';
import ApiSelector from './ApiSelector';
import Toggle from '../shared/components/Toggle/Toggle';
import { DEV_ENV, Colors, StorageKeys } from '../shared/constants';
import { browser } from 'webextension-polyfill-ts';

import './styles.scss';

const Popup: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);

  const manifest = browser.runtime.getManifest();

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.ENABLED)
      .then((result) => {
        if (result[StorageKeys.ENABLED])
          setEnabled(result[StorageKeys.ENABLED]);
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    browser.storage.local
      .set({ [StorageKeys.ENABLED]: enabled })
      .then(() => {
        if (DEV_ENV)
          console.log(`content script  ${enabled ? 'enabled' : 'disabled'}`);
      })
      .catch(onError);
  }, [enabled]);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('Storage enabled state error = ', error);
  };

  return (
    <section id='popup'>
      <h2>Willkommen bei {manifest.name}</h2>
      <Toggle
        on={enabled}
        handleToggle={() => setEnabled(!enabled)}
        color={Colors.green}
        scale={0.5}
        label={`${manifest.name} aktivieren`}
      />
      {DEV_ENV ? <ApiSelector /> : null}
    </section>
  );
};

export default Popup;
