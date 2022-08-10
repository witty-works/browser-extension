import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { dropdownOptions, StorageKeys } from '../../shared/constants';
import '../styles.scss';
import Dropdown from '../../shared/components/Dropdown/Dropdown';
import defaultConfig from '../../witty.config.json';
import { handleDropdownChange, onError } from '../PopupUtils';

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

  return (
    <Dropdown
      onDropdownChange={handleDropdownChange}
      options={dropdownOptions}
      selectedOption={delay}
    />
  );
};

export default DelaySelector;
