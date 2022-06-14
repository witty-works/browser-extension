import React, { useEffect, useState, ChangeEvent } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { storeInLocalStorage } from '../shared/utils';
import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';
import { GermanGenderEndings, StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import Lock from '../assets/icons/options/lock.svg';
interface SelectorProps {
  locked?: boolean;
  userIsLoggedIn?: boolean;
  selectedValue: string;
  resetSettings?: boolean;
}
const GermanGenderEndSelector: React.FC<SelectorProps> = ({
  locked,
  userIsLoggedIn = false,
  selectedValue,
  resetSettings = false,
}: SelectorProps) => {
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

    if (locked && userIsLoggedIn) {
      const lockedKeyValuePair = dropdownOptions.find(
        (option: OptionProp) => option.value === selectedValue
      );
      if (lockedKeyValuePair) {
        setDropdownOptions([lockedKeyValuePair]);
        setSelectedOption(selectedValue);
      }
    } else {
      setDropdownOptions(dropdownOptions);
      browser.storage.local
        .get(StorageKeys.GERMAN_GENDER_ENDING)
        .then((result) => {
          if (result[StorageKeys.GERMAN_GENDER_ENDING].value)
            setSelectedOption(result[StorageKeys.GERMAN_GENDER_ENDING].value);
        })
        .catch(onError);
    }
  }, []);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  useEffect(() => {
    setSelectedOption(selectedValue);
    storeInLocalStorage(StorageKeys.GERMAN_GENDER_ENDING, {
      value: selectedValue,
    });
  }, [resetSettings]);

  const handleDropdownChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value: string = event.currentTarget.value;
    console.log(
      'AAA GermanGenderEndSelector handleDropdownChange value',
      value
    );

    setSelectedOption(value);
    storeInLocalStorage(StorageKeys.GERMAN_GENDER_ENDING, { value });
  };

  return (
    <div>
      <div className='dropdown-title-wrapper'>
        <label>{t('germanGenderEnding')}</label>
        {locked && userIsLoggedIn && (
          <>
            <div className='dropdown-lock'>
              <Lock />
              {<div className='dropdown-lock-info'>{t('lockedInfo')}</div>}
            </div>
          </>
        )}
      </div>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
        locked={locked && userIsLoggedIn}
      />
    </div>
  );
};

export default GermanGenderEndSelector;
