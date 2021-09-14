import { IRequest } from '../types';
import { BaseUrls, StorageKeys } from '../constants';
import { browser } from 'webextension-polyfill-ts';

let BASE_URL: string = '';

const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => BASE_URL = BaseUrls[urlKey as keyof typeof BaseUrls];

let appID:string = '';

//Get Extension Unique ID
browser.storage.local
  .get(StorageKeys.UNIQUE_ID)
  .then((result) => {
    appID = result.id;
  })
  .catch(error => console.log('getAppID error = ', error));


export const getAnalyzedTextResults = (text: string):IRequest => {
  return {
    url: createUrl(BASE_URL, 'check'),
    config:{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({text: text, lang: 'auto', id: appID})
    }
  }
};