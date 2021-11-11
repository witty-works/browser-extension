import React, { useState, useEffect } from 'react';
import ApiSelector from './ApiSelector';
import Toggle from '../shared/components/Toggle/Toggle';
import { DEV_ENV, StorageKeys, Colors } from '../shared/constants';
import { browser } from 'webextension-polyfill-ts';

import './styles.scss';

const Popup: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(true);

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
    <>
      <header>
        <h1>
          <img
            className='icon'
            alt='Witty Works Logo'
            width='100'
            height='15'
            src={browser.runtime.getURL('../assets/icons/witty-logo-color.svg')}
          />
        </h1>
      </header>
      <hr></hr>
      <section>
        <h2>Einstellung</h2>
        <Toggle
          on={enabled}
          handleToggle={() => setEnabled(!enabled)}
          color={Colors.green}
          scale={0.35}
          label={`${manifest.name} aktivieren`}
        />
      </section>
      {DEV_ENV ? (
        <>
          <hr></hr>
          <section>
            <h2>Entwicklung Einstellungen</h2>
            <ApiSelector />
          </section>
        </>
      ) : null}
    </>
  );
};

export default Popup;
