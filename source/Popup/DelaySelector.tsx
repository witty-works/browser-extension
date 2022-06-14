import React, { useEffect, useState, ChangeEvent } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { storeInLocalStorage } from '../shared/utils';
import { StorageKeys } from '../shared/constants';
import './styles.scss';
import { logTypes, useLog } from '../shared/customHooks/useLog';
import Dropdown from '../shared/components/Dropdown/Dropdown';
const log = useLog('Popup');
import defaultConfig from '../witty.config.json';

export interface OptionProp {
  key: string;
  value: string;
}

const DelaySelector: React.FC = () => {
  const [delay, setDelay] = useState<number>(defaultConfig.API_DELAY);

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.API_DELAY)
      .then((result) => {
        setDelay(result[StorageKeys.API_DELAY]);
      })
      .catch(onError);
  }, []);

  const handleDropdownChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value: number = parseInt(event.currentTarget.value);
    setDelay(value);
    storeInLocalStorage(StorageKeys.API_DELAY, value);
  };

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const dropdownOptions = [
    {
      key: 0,
      value: '0 seconds',
    },
    {
      key: 500,
      value: '0.5 seconds',
    },
    {
      key: 1000,
      value: '1 second',
    },
    {
      key: 1500,
      value: '1.5 seconds',
    },
    {
      key: 2000,
      value: '2 seconds',
    },
    {
      key: 2500,
      value: '2.5 seconds',
    },
    {
      key: 3000,
      value: '3 seconds',
    },
  ];

  return (
    <>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={delay}
      />
    </>
  );
};

export default DelaySelector;
