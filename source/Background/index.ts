import {browser} from 'webextension-polyfill-ts';

import { DEV_ENV, StorageKeys } from '../shared/constants';
import { isFunction } from '../shared/utils';
import defaultConfig from "../witty.config.json";

type DefaultConfigValue = string | boolean | string[] | (() => string);

//Generate unique ID if it's no already defined
//TODO move it to witty.config.json
let disableID:boolean = false;

const onSave = (key: string, value: DefaultConfigValue) => {
  if (DEV_ENV) console.log(`Key *${key}* with value *${value}* saved correctly in local storage`);
};

const onError = (error: string) => {
  if (DEV_ENV) console.log(`Local Storage Error: ${error}`);
};

const getRandomToken = () => {
  const bytes = new Uint8Array(32);  //256 bits token

  window.crypto.getRandomValues(bytes);

  // convert byte array to hexademical representation
  const bytesHex = bytes.reduce((item, acc) => item + (`00${acc.toString(16)}`).slice(-2), '');

  // convert hexademical value to a decimal string
  return BigInt('0x' + bytesHex).toString(10);
}

const setInLocalStorage = (key: string, value: DefaultConfigValue):void => {
  //Check if setting is already defined in the local storage
  //If not, then add it
  browser.storage.local.get()
  .then((result)=>{
    let savedValue:DefaultConfigValue = result[key];
    if(!savedValue){
      let valueToSave = (isFunction(value as Function)) ? (value as Function)() : value;
      browser.storage.local.set({ [key]: valueToSave })
        .then(()=> onSave(key, valueToSave))
        .catch(onError);
    }
  })
  .catch(onError);
}


const setSettings = () => {

  //Set default settings
  for (let [defaultConfigKey, defaultConfigValue] of Object.entries(defaultConfig)) {
    if(defaultConfigKey in StorageKeys) {
      const storageKey = StorageKeys[defaultConfigKey as keyof typeof StorageKeys];
      setInLocalStorage(storageKey, defaultConfigValue)
    }
  }

  //Set ID if we are not in DEV mode
  if(!disableID) setInLocalStorage(StorageKeys.APP_ID, getRandomToken)
}

setSettings();