import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import DropdownMultiSelect from '../shared/components/DropdownMultiSelect/DropdownMultiSelect';
import { OptionProp } from '../shared/components/DropdownMultiSelect/DropdownMultiSelect';
import { DEV_ENV, Languages, StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';

const PreferredLanguagesSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<OptionProp[]>([]);
  const { t } = useTranslation(namespaces.pages.popup);

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(Languages).map(
      (key: string) => ({
        value: key.replace('_', '-'),
        label: Languages[key as keyof typeof Languages],
      })
    );

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
              label: Languages[opt.replace('-', '_') as keyof typeof Languages],
            };
          });
          setSelectedOption(selecOptions);
        }
      })
      .catch(onError);
  }, []);

  const onError = (error: string) => {
    if (DEV_ENV) console.log('PreferedLanguageSelector onError = ', error);
  };

  const handleDropdownChange = (options: OptionProp[]) => {
    const prefLanguages: string[] = options.map((option) => option.value);
    browser.storage.local
      .set({ [StorageKeys.PREFERRED_LANGUAGES]: prefLanguages })
      .then(() => {
        if (DEV_ENV)
          console.log(
            `new Preferred languages ${prefLanguages.join(',')} saved`
          );
      })
      .catch(onError);

    // window.close();
  };

  return (
    <div>
      <label>{t('preferredLanguage')}:</label>
      <DropdownMultiSelect
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOptions={selectedOption}
      />
    </div>
  );
};

export default PreferredLanguagesSelector;
