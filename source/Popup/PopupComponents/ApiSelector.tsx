import React, {useEffect, useState} from 'react';
import browser from 'webextension-polyfill';

import Dropdown, {OptionProp} from '../../shared/components/Dropdown/Dropdown';
import {BaseUrls, DefaultBaseUrlKey, StorageKeys} from '../../shared/constants';
import {logTypes, useLog} from '../../shared/customHooks/useLog';
import {sendErrorToSentry} from '../../shared/errorUtils';
import {logOut, signOutThroughBackground} from '../../shared/utils';

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
    // Always drop credentials when the endpoint changes. Tokens are issued
    // by one dashboard and are meaningless — and must not be presented — to
    // another. Signed out before the switch, so the token is revoked on the
    // dashboard that issued it.
    const signOut =
      value !== selectedOption
        ? signOutThroughBackground().then(logOut)
        : Promise.resolve();
    signOut
      .then(() =>
        browser.storage.local.set({
          [StorageKeys.API_ENDPOINT_KEY]: value,
        })
      )
      .then(() => {
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
