import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import DropdownMultiSelect from '../shared/components/DropdownMultiSelect/DropdownMultiSelect';
import { OptionProp } from '../shared/components/DropdownMultiSelect/DropdownMultiSelect';
import { StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import Lock from '../assets/icons/options/lock.svg';
interface SelectorProps {
  locked?: boolean;
  userIsLoggedIn?: boolean;
  selectedValue: string[];
  resetSettings?: boolean;
}
const PreferredLanguagesSelector: React.FC<SelectorProps> = ({
  locked,
  userIsLoggedIn = false,
  selectedValue,
  resetSettings = false,
}: SelectorProps) => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<OptionProp[]>([]);
  const { t } = useTranslation(namespaces.pages.options);
  const log = useLog('PreferredLanguagesSelector');

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(
      t('languages', {
        ns: namespaces.common,
        returnObjects: true,
      })
    ).map((key: string) => ({
      value: key.replace('_', '-'),
      label: t(`languages.${key}`, {
        ns: namespaces.common,
      }),
    }));

    setDropdownOptions(dropdownOptions);

    browser.storage.local
      .get(StorageKeys.PREFERRED_LANGUAGES)
      .then((result) => {
        if (result[StorageKeys.PREFERRED_LANGUAGES]) {
          const selecOptions: OptionProp[] = result[
            StorageKeys.PREFERRED_LANGUAGES
          ].map((opt: string) => {
            return {
              value: opt,
              label: t(`languages.${opt.replace('-', '_')}`, {
                ns: namespaces.common,
              }),
            };
          });
          setSelectedOption(selecOptions);
        }
      })
      .catch(onError);
  }, []);

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  useEffect(() => {
    console.log('selectedValue', selectedValue);
    //get labels for each selectedValue.value and create OptionProp
    const selectedKey = selectedValue.map((value: string) => {
      return {
        value: value,
        label: t(`languages.${value.replace('-', '_')}`, {
          ns: namespaces.common,
        }),
      };
    });
    console.log(selectedKey);
    handleDropdownChange(selectedKey);
  }, [resetSettings]);

  const handleDropdownChange = (options: OptionProp[]) => {
    const prefLanguages: string[] = options.map((option) => option.value);
    browser.storage.local
      .set({ [StorageKeys.PREFERRED_LANGUAGES]: prefLanguages })
      .then(() => {
        log(`New Preferred languages ${prefLanguages.join(',')} saved`);
      })
      .catch(onError);
    setSelectedOption(options);
  };

  return (
    <div>
      <div className='dropdown-title-wrapper'>
        <label>{t('preferredLanguage')}</label>
        {locked && userIsLoggedIn && (
          <>
            <div className='dropdown-lock'>
              <Lock />
              {<div className='dropdown-lock-info'>{t('lockedInfo')}</div>}
            </div>
          </>
        )}
      </div>
      <DropdownMultiSelect
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOptions={selectedOption}
        disabled={locked && userIsLoggedIn}
      />
    </div>
  );
};

export default PreferredLanguagesSelector;
