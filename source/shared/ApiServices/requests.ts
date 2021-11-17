import { IRequest, IAlternative, RequestConfig } from '../types';
import { BaseUrls} from '../constants';

let BASE_URL: string = '';
let appID:string = '';
let requestConfig:RequestConfig = {} as RequestConfig;

const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => BASE_URL = BaseUrls[urlKey as keyof typeof BaseUrls];
export const setRequestConfig = (reqConfig:RequestConfig) => requestConfig = reqConfig;
export const setAppID = (id: string) => appID = id;

export const getAnalyzedTextResults = (text: string):IRequest => {
  return {
    url: createUrl(BASE_URL, 'check'),
    config:{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: text ? JSON.stringify({text: text, lang: 'auto', id:appID, config: requestConfig}) : null
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
      body: alternative.text ? JSON.stringify({text: alternative.text, lang: 'auto', id: appID, config:requestConfig, alternative: alternative.alternative, start: alternative.start, end: alternative.end}) : null
    }
  }
}