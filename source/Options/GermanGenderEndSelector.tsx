import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import { sendErrorToSentry } from '../shared/errorUtils';
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
          if (result[StorageKeys.GERMAN_GENDER_ENDING])
            setSelectedOption(result[StorageKeys.GERMAN_GENDER_ENDING]);
        })
        .catch(onError);
    }
  }, []);

  const onError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  useEffect(() => {
    const selectedKey = dropdownOptions.find(
      (option: OptionProp) => option.value === selectedValue
    );
    handleDropdownChange(selectedKey?.key as string);
  }, [resetSettings]);

  const handleDropdownChange = (value: string) => {
    setSelectedOption(value);
    browser.storage.local
      .set({ [StorageKeys.GERMAN_GENDER_ENDING]: value })
      .then(() => {
        log(`New German Gender Ending ${value} saved`);
      })
      .catch(onError);
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
