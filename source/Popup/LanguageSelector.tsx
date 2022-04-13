import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionProp } from '../shared/components/Dropdown/Dropdown';
import { StorageKeys } from '../shared/constants';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useLog, logTypes } from '../shared/customHooks/useLog';

const LanguageSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const { t } = useTranslation(namespaces.pages.options);
  const log = useLog('LanguageSelector');

  useEffect(() => {
    const dropdownOptions: OptionProp[] = Object.keys(
      t('languages', {
        ns: namespaces.common,
        returnObjects: true,
      })
    ).map((key: string) => ({
      key: key.replace('_', '-'),
      value: t(`languages.${key}`, {
        ns: namespaces.common,
      }),
    }));

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
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
  };

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({ [StorageKeys.PRIMARY_LANGUAGE]: value })
      .then(() => {
        log(`New language ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <label>{t('primaryLanguage')}</label>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default LanguageSelector;
