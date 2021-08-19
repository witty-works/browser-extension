import React, { useEffect, useState } from 'react';
import { browser /*Tabs*/ } from 'webextension-polyfill-ts';
import Dropdown from '../shared/components/Dropdown/Dropdown';
import { OptionsProp } from '../shared/components/Dropdown/Dropdown';

import {
  BaseUrls,
  DefaultBaseUrlKey,
} from '../shared/ApiServices/baseUrl.constants';
import { StorageKeys } from '../shared/constants';

import './styles.scss';

// function openWebPage(url: string): Promise<Tabs.Tab> {
//   return browser.tabs.create({ url });
// }

const Popup: React.FC = () => {
  // const manifest = browser.runtime.getManifest();

  const [dropdownOptions, setDropdownOptions] = useState<OptionsProp[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');

  useEffect(() => {
    const dropdownOptions: OptionsProp[] = Object.keys(BaseUrls).map(
      (key: string) => ({
        key,
        value: BaseUrls[key as keyof typeof BaseUrls],
      })
    );

    setDropdownOptions(dropdownOptions);

    browser.storage.local
      .get(StorageKeys.API_ENDPOINT_KEY)
      .then((result) => {
        console.log('result = ', result);
        if (result[StorageKeys.API_ENDPOINT_KEY])
          setSelectedOption(result[StorageKeys.API_ENDPOINT_KEY]);
        else setSelectedOption(DefaultBaseUrlKey);
      })
      .catch(onError);

    // setSelectedOption(DefaultBaseUrlKey);
  }, []);

  // const sendMessageToTabs = (tabs: any, command: string, value: string) => {
  //   //TODO Specify tabs type
  //   console.log('tabs = ', tabs);
  //   console.log('value = ', value);

  //   browser.tabs
  //     .sendMessage(tabs[0].id, {
  //       command,
  //       value,
  //     })
  //     .then((response) => {
  //       console.log('Message from the contentScript = ', response.message);
  //     })
  //     .catch(onTabsError);
  // };

  const onError = (error: string) => {
    console.log('onError = ', error);
  };

  const handleDropdownChange = (value: string) => {
    console.log('handleDropdownChange value = ', value);

    browser.storage.local
      .set({ [StorageKeys.API_ENDPOINT_KEY]: value })
      .then(() => console.log(`new api endpoint ${value} saved`))
      .catch(onError);

    window.close();

    // setSelectedOption(value);

    // browser.tabs
    //   .query({
    //     currentWindow: true,
    //     active: true,
    //   })
    //   .then((tabs) => sendMessageToTabs(tabs, 'UPDATE_API_BASE_URL', value))
    //   .catch(onTabsError);
  };

  return (
    <section id='popup'>
      <h2>Options</h2>
      <label>Select API:</label>
      <Dropdown
        onDropdownChange={handleDropdownChange}
        options={dropdownOptions}
        selectedOption={selectedOption}
      />
    </section>
  );
};

export default Popup;
