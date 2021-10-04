import { IRequest, IAlternative } from '../types';
import { BaseUrls, StorageKeys, DEV_ENV } from '../constants';
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
  .catch(error => (DEV_ENV) ? console.log('getAppID error = ', error) : null);


export const getAnalyzedTextResults = (text: string):IRequest => {
  return {
    url: createUrl(BASE_URL, 'check'),
    config:{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: text ? JSON.stringify({text: text, lang: 'auto', id: appID}) : null
    }
  }
};

export const logAlternative = (alternative: IAlternative) => {
  return {
    url: createUrl(BASE_URL, 'log'),
    config: {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: alternative.text ? JSON.stringify({text: alternative.text, lang: 'auto', id: appID, alternative: alternative.alternative, start: alternative.start, end: alternative.end}) : null
    }
  }
}