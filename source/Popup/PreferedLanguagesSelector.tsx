import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import DropdownMultiSelect from '../shared/components/DropdownMultiSelect/DropdownMultiSelect';
import { OptionProp } from '../shared/components/DropdownMultiSelect/DropdownMultiSelect';
import { StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

const PreferredLanguagesSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<OptionProp[]>([]);
  const { t } = useTranslation(namespaces.pages.popup);
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

  const handleDropdownChange = (options: OptionProp[]) => {
    const prefLanguages: string[] = options.map((option) => option.value);
    browser.storage.local
      .set({ [StorageKeys.PREFERRED_LANGUAGES]: prefLanguages })
      .then(() => {
        log(`New Preferred languages ${prefLanguages.join(',')} saved`);
      })
      .catch(onError);

    // window.close();
  };

  return (
    <div>
      <label>{t('preferredLanguage')}</label>
      <DropdownMultiSelect
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOptions={selectedOption}
      />
    </div>
  );
};

export default PreferredLanguagesSelector;
