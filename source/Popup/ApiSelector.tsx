import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionsProp } from '../shared/components/Dropdown/Dropdown';

import {
  DEV_ENV,
  BaseUrls,
  DefaultBaseUrlKey,
  StorageKeys,
} from '../shared/constants';

const ApiSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionsProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');

  useEffect(() => {
    const dropdownOptions: OptionsProp[] = Object.keys(BaseUrls).map(
      (key: string) => ({
        key,
        value: BaseUrls[key as keyof typeof BaseUrls],
      })
    );

    setDropdownOptions(dropdownOptions);

    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setSelectedOption(result[StorageKeys.API_ENDPOINT_KEY]);
        else setSelectedOption(DefaultBaseUrlKey);
      })
      .catch(onError);
  }, []);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('ApiSelector onError = ', error);
  };

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({ [StorageKeys.API_ENDPOINT_KEY]: value })
      .then(() => {
        if (DEV_ENV) console.log(`new api endpoint ${value} saved`);
      })
      .catch(onError);

    window.close();
  };

  return (
    <div>
      <label>Select API:</label>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default ApiSelector;
