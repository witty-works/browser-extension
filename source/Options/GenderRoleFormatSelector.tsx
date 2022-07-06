import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Dropdown, { OptionProp } from '../shared/components/Dropdown/Dropdown';
import { StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import Lock from '../assets/icons/options/lock.svg';
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
  const [selectedOption, setSelectedOption] = useState<string>('');
  const { t } = useTranslation(namespaces.pages.options);
  const log = useLog('GermanGenderEndSelector');

  const GenderRoleFormat = {
    inclusive_gender: t('genderRoleFormatGermanEnding'),
    both: t('genderRoleFormatBoth'),
    binary_gender: t('genderRoleFormatFemaleAndMale'),
    none: t('genderRoleFormatNone'),
  };

  const dropdownOptions = Object.keys(GenderRoleFormat).map((key: string) => ({
    key,
    value: GenderRoleFormat[key as keyof typeof GenderRoleFormat],
  }));

  useEffect(() => {
    if (!userIsLoggedIn) {
      setSelectedOption('both'); //default value when not logged in (teams only feature)
    } else if (locked && userIsLoggedIn) {
      setSelectedOption(selectedValue); //locked value set on dashboard, passed from options.tsx
    } else {
      browser.storage.local
        .get(StorageKeys.GENDERED_ROLES_FORMAT)
        .then((result) => {
          if (result[StorageKeys.GENDERED_ROLES_FORMAT])
            setSelectedOption(result[StorageKeys.GENDERED_ROLES_FORMAT].value);
        })
        .catch(onError);
    }
  }, []);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  useEffect(() => {
    if (resetSettings) {
      const selectedKey = dropdownOptions.find(
        (option: OptionProp) => option.key === selectedValue
      );
      handleDropdownChange(selectedKey?.key as string);
    }
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

        {!hasWittyTeams && (
          <div className='witty-teams-only-dropdown'>
            <a
              className='witty-teams-only-link'
              href='https://www.witty.works/witty-for-teams'
              target='_blank'
            >
              {t('wittyTeamsOnly')}
            </a>
          </div>
        )}
        {locked && hasWittyTeams && userIsLoggedIn && (
          <div className='dropdown-lock'>
            <Lock />
            <div className='dropdown-lock-info'>{t('lockedInfo')}</div>
          </div>
        )}
      </div>
      <div className='wittyworks-options-content-section-container-subtitle'>
        {t('genderRoleFormatExplanation')}
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
