import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';

import { DEV_ENV, Languages, StorageKeys } from '../shared/constants';

const LanguageSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(Languages).map(
      (key: string) => ({
        key: key.replace('_', '-'),
        value: Languages[key as keyof typeof Languages],
      })
    );

    setDropdownOptions(dropdownOptions);

    browser.storage.local
      .get(StorageKeys.PRIMARY_LANGUAGE)
      .then((result) => {
        if (result[StorageKeys.PRIMARY_LANGUAGE])
          setSelectedOption(result[StorageKeys.PRIMARY_LANGUAGE]);
      })
      .catch(onError);
  }, []);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('LanguageSelector onError = ', error);
  };

  const handleDropdownChange = (value: string) => {
    console.log('handleDropdownChange value = ', value);
    browser.storage.local
      .set({ [StorageKeys.PRIMARY_LANGUAGE]: value })
      .then(() => {
        if (DEV_ENV) console.log(`new language ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <label>Select Primary Language:</label>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default LanguageSelector;
