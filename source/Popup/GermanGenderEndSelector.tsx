import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';
import { GermanGenderEndings, StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

const GermanGenderEndSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const { t } = useTranslation(namespaces.pages.options);
  const log = useLog('GermanGenderEndSelector');

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(GermanGenderEndings).map(
      (key: string) => ({
        key,
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
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({ [StorageKeys.GERMAN_GENDER_ENDING]: value })
      .then(() => {
        log(`New German Gender Ending ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <label>{t('germanGenderEnding')}</label>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default GermanGenderEndSelector;
