import { IRequest, RequestConfig } from '../types';
import { BaseUrls, wittyVersion } from '../constants';

let BASE_URL: string = '';
export let appID: string = ''; // TODO context hook
export let requestConfig: RequestConfig = {} as RequestConfig;

const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => BASE_URL = BaseUrls[urlKey as keyof typeof BaseUrls];
export const setRequestConfig = (reqConfig: RequestConfig) => requestConfig = reqConfig;
export const setAppID = (id: string) => appID = id;
export const getAnalyzedTextResults = (text: string): IRequest => {
  return {
    url: createUrl(BASE_URL, 'check'),
    config: {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: text ? JSON.stringify({ text: text, lang: 'auto', id: appID, client: wittyVersion, config: requestConfig }) : null
    }
  }
};
