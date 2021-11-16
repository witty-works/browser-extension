import { IRequest, IAlternative, RequestConfig } from '../types';
import { BaseUrls, GermanGenderEndings, DEV_ENV } from '../constants';
import { browser } from 'webextension-polyfill-ts';

let BASE_URL: string = '';

const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => BASE_URL = BaseUrls[urlKey as keyof typeof BaseUrls];

let appID:string = '';
const config:RequestConfig = {} as RequestConfig;

//Get App Settings
browser.storage.local
  .get(null)
  .then((result) => {
    //If StorageKeys.APP_ID does not exist (e.g. we are in DEV mode) appID will be undefined
    //and will not be sent in the options
    appID = result.id;
    config.primary_language = result.primaryLanguage;
    config.preferred_languages = result.preferredLanguages.map((lang:string) => lang.split('-')[0]).join(',');
    config.preferred_variants = result.preferredLanguages.join(',');
    config.german_gender_ending = GermanGenderEndings[result.germanGenderEnding as keyof typeof GermanGenderEndings]
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
      body: text ? JSON.stringify({text: text, lang: 'auto', id:appID, config}) : null
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
      body: alternative.text ? JSON.stringify({text: alternative.text, lang: 'auto', id: appID, config, alternative: alternative.alternative, start: alternative.start, end: alternative.end}) : null
    }
  }
}