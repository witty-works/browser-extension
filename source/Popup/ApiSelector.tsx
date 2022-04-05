import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';
import { BaseUrls, DefaultBaseUrlKey, StorageKeys } from '../shared/constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

const ApiSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const log = useLog('ApiSelector');

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(BaseUrls).map(
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
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({ [StorageKeys.API_ENDPOINT_KEY]: value })
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
