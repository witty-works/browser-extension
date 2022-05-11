import { IRequest, RequestConfig } from '../types';
import { BaseUrls, wittyVersion } from '../constants';

let BASE_URL: string[] = [];
let token: string = '';
export let appID: string = ''; // TODO context hook
export let requestConfig: RequestConfig = {} as RequestConfig;

const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => (BASE_URL = BaseUrls[urlKey]);
console.log('BASE_URL', BASE_URL);

export const setRequestConfig = (reqConfig: RequestConfig) =>
  (requestConfig = reqConfig);

export const setAppID = (id: string) => (appID = id);

export const setToken = (tok: string) => (token = tok);

export const getAnalyzedTextResults = (text: string): IRequest => {
  return {
    url: createUrl(BASE_URL[0], 'v1.1/check'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token !== '' ? `Bearer ${token}` : 'Basic',
      },
      body: text
        ? JSON.stringify({
            text: text,
            lang: 'auto',
            id: appID,
            client: wittyVersion,
            config: requestConfig,
          })
        : null,
    },
  };
};

export const getConfiguration = (): IRequest => {
  return {
    url: createUrl(BASE_URL[0], 'auth'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  };
};

export const getToken = (refreshToken: string): IRequest => {
  return {
    url: createUrl(BASE_URL[1], 'api/refresh-token'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: refreshToken,
      }),
    },
  };
};
