import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import { POSTHOG_API_KEY, wittyVersion } from '../constants';
import { IAlert, ILogRequest, ILogResponse } from '../types';

export const useAnalytics = () => {
  const ph = browserPostHog(POSTHOG_API_KEY);

  return {
    async alternativeLog(logResponse: IAlert) {
      const { appID, requestConfig } = await import("./requests");
      ph.session.distinctId = appID;

      const request: ILogRequest[] = [{
        type: 'alternative',
        lang: 'auto',
        id: appID,
        client: wittyVersion,
        config: requestConfig,
        text: { }, //TODO
      }];

      ph.capture('alternative', {
        request,
        response: logResponse
      });
    },

    async ignoreLog(logResponse: IAlert) {
      const { appID, requestConfig } = await import("./requests");
      ph.session.distinctId = appID;

      const request: ILogRequest[] = [{
        type: 'ignore',
        lang: 'auto',
        id: appID,
        client: wittyVersion,
        config: requestConfig,
        text: { }, //TODO
      }];

      ph.capture('ignore', {
        request,
        response: logResponse
      });
    },
    async checkLog(logResponse: ILogResponse, inputLength: number) {
      const { appID, requestConfig } = await import("./requests");
      ph.session.distinctId = appID;

      const request: ILogRequest[] = [{
        type: 'check',
        lang: 'auto',
        id: appID,
        client: wittyVersion,
        config: requestConfig,
        text: { "length": inputLength }, 
      }];

      ph.capture('check', {
        request,
        response: logResponse
      });
    }
  }
};