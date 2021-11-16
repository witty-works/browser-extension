import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';

import { DEV_ENV, GermanGenderEndings, StorageKeys } from '../shared/constants';

const GermanGenderEndSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(GermanGenderEndings).map(
      (key: string) => ({
        key: key.replace('_', '-'),
        value: GermanGenderEndings[key as keyof typeof GermanGenderEndings],
      })
    );

    setDropdownOptions(dropdownOptions);

    browser.storage.local
      .get(StorageKeys.GERMAN_GENDER_ENDING)
      .then((result) => {
        if (result[StorageKeys.GERMAN_GENDER_ENDING])
          setSelectedOption(result[StorageKeys.GERMAN_GENDER_ENDING]);
      })
      .catch(onError);
  }, []);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('GermanGenderEndSelector onError = ', error);
  };

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({ [StorageKeys.GERMAN_GENDER_ENDING]: value })
      .then(() => {
        if (DEV_ENV) console.log(`new German Gender Ending ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <label>Select German Gender Ending:</label>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default GermanGenderEndSelector;
