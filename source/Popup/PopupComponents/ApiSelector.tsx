import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Dropdown, {
  OptionProp,
} from '../../shared/components/Dropdown/Dropdown';
import {
  BaseUrls,
  DefaultBaseUrlKey,
  StorageKeys,
} from '../../shared/constants';
import { useLog } from '../../shared/customHooks/useLog';
import { onError } from '../PopupUtils';

const ApiSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const log = useLog('ApiSelector');

  useEffect(() => {
    const dropdownOptionsTemp: OptionProp[] = Object.keys(BaseUrls).map(
      (key: string) => ({
        key,
        value: key,
      })
    );

    setDropdownOptions(dropdownOptionsTemp);

    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setSelectedOption(result[StorageKeys.API_ENDPOINT_KEY]);
        else setSelectedOption(DefaultBaseUrlKey as string);
      })
      .catch(onError);
  }, []);

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({
        [StorageKeys.API_ENDPOINT_KEY]: value,
      })
      .then(() => {
        log(`New api endpoint ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default ApiSelector;
