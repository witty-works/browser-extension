import React, {useEffect, useState} from 'react';
import browser from 'webextension-polyfill';

import Dropdown, {OptionProp} from '../../shared/components/Dropdown/Dropdown';
import {BaseUrls, DefaultBaseUrlKey, StorageKeys} from '../../shared/constants';
import {logTypes, useLog} from '../../shared/customHooks/useLog';
import {sendErrorToSentry} from '../../shared/errorUtils';
import {logOut} from '../../shared/utils';

const ApiSelector: React.FC = () => {
  const [dropdownOptions, setDropdownOptions] = useState<OptionProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const log = useLog('ApiSelector');

  const onError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  useEffect(() => {
    const dropdownOptionsTemp: OptionProp[] = Object.keys(BaseUrls).map(
      (key: string) => {
        return {
          key,
          value: key,
        };
      }
    );

    setDropdownOptions(dropdownOptionsTemp);

    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setSelectedOption(result[StorageKeys.API_ENDPOINT_KEY]);
        else setSelectedOption(DefaultBaseUrlKey as string);
      })
      .catch(onError);
  }, []);

  const handleDropdownChange = (value: string) => {
    browser.storage.local
      .set({
        [StorageKeys.API_ENDPOINT_KEY]: value,
      })
      .then(() => {
        // Always drop credentials when the endpoint changes. Tokens are issued
        // by one dashboard and are meaningless — and must not be presented — to
        // another. The previous check only logged out for 'Prod' (and compared
        // against a typo'd ' Prod'), so switching between any other pair of
        // endpoints carried the old tokens across.
        if (value !== selectedOption) {
          logOut();
        }
        setSelectedOption(value);
        log(`New api endpoint ${value} saved`);
      })
      .catch(onError);
  };

  return (
    <div>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
};

export default ApiSelector;
