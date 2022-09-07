import { IRequest, RequestConfig } from '../types';
import { BaseUrls, wittyVersion } from '../constants';

let BASE_URL_API: string = '';
let BASE_URL_DASHBOARD: string = '';
let token: string = '';
let configHash: string = '';
let organizationConfigHash: string = '';

export let appID: string = ''; // TODO context hook
export let requestConfig: RequestConfig = {} as RequestConfig;

export const createUrl = (base: string, path: string): string =>
  `${base}${path}`;

export const setBaseUrls = (urlKey: string) => {
  BASE_URL_API = BaseUrls[urlKey].api;
  BASE_URL_DASHBOARD = BaseUrls[urlKey].dashboard;
};

export const getBaseUrls = () => {
  return { api: BASE_URL_API, dashboard: BASE_URL_DASHBOARD };
};

export const setRequestConfig = (reqConfig: RequestConfig) =>
  (requestConfig = reqConfig);

export const setAppID = (id: string) => (appID = id);

export const setToken = (tok: string) => (token = tok);

export const setConfigHash = (hash: string) => (configHash = hash);

export const setOrganizationConfigHash = (hash: string) =>
  (organizationConfigHash = hash);

export const getAnalyzedTextResults = (text: string): IRequest => {
  return {
    url: createUrl(BASE_URL_API, 'v2.0/check'),
    config: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: text
        ? JSON.stringify({
            text: text,
            lang: 'auto',
            id: appID,
            client: wittyVersion,
            config: requestConfig,
            config_hash: configHash,
            organization_config_hash: organizationConfigHash,
          })
        : null,
    },
  };
};

export const getConfiguration = (): IRequest => {
  return {
    url: BASE_URL_API && createUrl(BASE_URL_API, 'v2.0/auth'),
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
    url: createUrl(BASE_URL_DASHBOARD, 'api/refresh-token'),
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
