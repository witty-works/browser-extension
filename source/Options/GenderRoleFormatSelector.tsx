import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';
import { StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import Lock from '../assets/icons/options/lock.svg';
import PremiumOnly from '../assets/icons/options/premium-only.svg';
import './styles.scss';

interface SelectorProps {
  locked?: boolean;
  hasWittyTeams?: boolean;
  selectedValue: string;
  userIsLoggedIn?: boolean;
  resetSettings?: boolean;
}

const GenderRoleFormatSelector: React.FC<SelectorProps> = ({
  locked,
  hasWittyTeams = true,
  selectedValue,
  userIsLoggedIn = false,
  resetSettings = false,
}: SelectorProps) => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const { t } = useTranslation(namespaces.pages.options);
  const log = useLog('GermanGenderEndSelector');

  const GenderRoleFormat = {
    inclusive_gender: t('genderRoleFormatGermanEnding'),
    both: t('genderRoleFormatBoth'),
    binary_gender: t('genderRoleFormatFemaleAndMale'),
    none: t('genderRoleFormatNone'),
  };

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(GenderRoleFormat).map(
      (key: string) => ({
        key,
        value: GenderRoleFormat[key as keyof typeof GenderRoleFormat],
      })
    );

    if (locked && userIsLoggedIn) {
      const lockedKeyValuePair = dropdownOptions.find(
        (option: OptionProp) => option.key === selectedValue
      );
      if (lockedKeyValuePair) {
        setDropdownOptions([lockedKeyValuePair]);
        setSelectedOption(selectedValue);
      }
    } else {
      setDropdownOptions(dropdownOptions);
      browser.storage.local
        .get(StorageKeys.GENDERED_ROLES_FORMAT)
        .then((result) => {
          if (result[StorageKeys.GENDERED_ROLES_FORMAT])
            setSelectedOption(
              locked ? 'both' : result[StorageKeys.GENDERED_ROLES_FORMAT].value
            );
        })
        .catch(onError);
      handleDropdownChange(selectedValue);
    }
  }, []);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  useEffect(() => {
    const selectedKey = dropdownOptions.find(
      (option: OptionProp) => option.key === selectedValue
    );
    handleDropdownChange(selectedKey?.key as string);
  }, [resetSettings]);

  const handleDropdownChange = (value: string) => {
    if (!value) return;
    setSelectedOption(value);
    browser.storage.local
      .set({
        [StorageKeys.GENDERED_ROLES_FORMAT]: { value: value },
      })
      .then(() => {
        log(`New gender role format ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <div className='dropdown-title-wrapper'>
        <label>{t('genderRoleFormat')}</label>
        {locked && (
          <>
            {!hasWittyTeams && (
              <div className='dropdown-premium-only'>
                <a href='https://www.witty.works/pricing' target='_blank'>
                  <PremiumOnly />
                </a>
              </div>
            )}
            <div className='dropdown-lock'>
              <Lock />
              {hasWittyTeams && userIsLoggedIn && (
                <div className='dropdown-lock-info'>{t('lockedInfo')}</div>
              )}
            </div>
          </>
        )}
      </div>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
        locked={locked}
      />
    </div>
  );
};

export default GenderRoleFormatSelector;
