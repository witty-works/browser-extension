import { IRequest, ILog, RequestConfig } from '../types';
import { BaseUrls} from '../constants';
import { browser } from 'webextension-polyfill-ts';

let BASE_URL: string = '';
let appID:string = '';
let requestConfig:RequestConfig = {} as RequestConfig;

const wittyVersion = browser.runtime.getManifest().version;

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
      body: text ? JSON.stringify({text: text, lang: 'auto', id:appID, client: wittyVersion, config: requestConfig}) : null
    }
  }
};

export const logAction = (log: ILog) => {
  return {
    url: createUrl(BASE_URL, 'log'),
    config: {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: log.text ? JSON.stringify({
        text: log.text,
        lang: log.language,
        id: appID,
        client: wittyVersion,
        config: requestConfig,
        type:log.type,
        context: log.context,
        start: log.start,
        end: log.end,
        details: log.details,
      })
      : null
    }
  }
}