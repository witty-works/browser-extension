import React, {useEffect, useState} from 'react';
import browser from 'webextension-polyfill';
import {dropdownOptions, StorageKeys} from '../../shared/constants';
import '../styles.scss';
import Dropdown from '../../shared/components/Dropdown/Dropdown';
import defaultConfig from '../../witty.config.json';
import {logTypes, useLog} from '../../shared/customHooks/useLog';
import {sendErrorToSentry} from '../../shared/errorUtils';

export interface OptionProp {
  key: string;
  value: string;
}

const DelaySelector: React.FC = () => {
  const [delay, setDelay] = useState<number>(defaultConfig.API_DELAY);
  const log = useLog('DelaySelector');

  const onError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({[StorageKeys.API_DELAY]: value})
      .then(() => {
        log(`Witty ${StorageKeys.API_DELAY} *${value}* correctly saved`);
      })
      .catch(onError);
  };

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.API_DELAY)
      .then((result) => {
        setDelay(result[StorageKeys.API_DELAY]);
      })
      .catch(onError);
  }, []);

  return (
    <Dropdown
      onDropdownChange={handleDropdownChange}
      options={dropdownOptions}
      selectedOption={delay}
    />
  );
};

export default DelaySelector;
