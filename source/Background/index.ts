import {browser} from 'webextension-polyfill-ts';

import { DEV_ENV, StorageKeys } from '../shared/constants';

//Generate unique ID if it's no already defined

let disableID:boolean = true;

const onError = (error: string) => {
  if (DEV_ENV) console.log('Manage Unique ID onError = ', error);
};

const useToken = (id: string) => {
  // TODO: sent this information on every request
  if (DEV_ENV) console.log('useToken id = ', id);
}

const getRandomToken = () => {
  const bytes = new Uint8Array(32);  //256 bits token

  window.crypto.getRandomValues(bytes);

  // convert byte array to hexademical representation
  const bytesHex = bytes.reduce((item, acc) => item + (`00${acc.toString(16)}`).slice(-2), '');

  // convert hexademical value to a decimal string
  return BigInt('0x' + bytesHex).toString(10);
}

browser.storage.local.get(StorageKeys.UNIQUE_ID)
.then((result)=>{
  let id:string = result.id;

  if(id) useToken(id)
  else{

    id = DEV_ENV
      ? 'development'
      : disableID ? '':getRandomToken();

    if (id !== '') {
      browser.storage.local.set({ [StorageKeys.UNIQUE_ID]: id })
        .then(() => useToken(id))
        .catch(onError);
    }
  }
})
.catch(onError);