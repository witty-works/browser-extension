import { IRequest, ILog, RequestConfig } from '../types';
import { BaseUrls } from '../constants';
import { browser } from 'webextension-polyfill-ts';

let BASE_URL: string = '';
let appID: string = '';
let requestConfig: RequestConfig = {} as RequestConfig;

const wittyVersion = browser.runtime.getManifest().version;

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

export const postHogLog = (log: ILog) => {
  console.log("postHogLog", appID);
  return {
    // when self-hosting, substitute https://app.posthog.com/ for the URL of our instance.
    url: createUrl('https://app.posthog.com/', 'batch'),
    config: {
      method: 'POST',
      mode: 'no-cors' as const, //to avoid CORS error: see https://github.com/PostHog/posthog-js-lite/blob/master/src/index.ts#L110-L111
      credentials: 'omit' as const,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: log.text ? JSON.stringify({
        api_key: '', //add somewhere else + use alias
        properties: {
          lang: log.language,
          id: appID,
          client: wittyVersion,
          config: requestConfig,
          type: log.type,
          context: log.context,
          start: log.start,
          end: log.end,
          details: log.details,
        },
        context: {}, //TODO
        distinct_id: 'appID', //TODO
        type: 'capture', //TODO
        event: log.type,
        messageId: '1234',
        text: log.text,

      }) : null
    }
  }
};