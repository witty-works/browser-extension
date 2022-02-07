import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import { POSTHOG_API_KEY, wittyVersion } from '../constants';
import {
  IAlert,
  ILogResponse,
  ICheckLogRequest,
  IIgnoreLogRequest,
  IAlternativeLogRequest,
  ILogRequest,
} from '../types';

export const useAnalytics = () => {
  const ph = browserPostHog(POSTHOG_API_KEY);

  return {
    async alternativeLog(logResponse: IAlert, alternative: string) {
      const { appID, requestConfig } = await import('./requests');
      ph.session.distinctId = appID;

      const request: IAlternativeLogRequest = {
        request__type: 'alternative',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__primary_language: requestConfig.primary_language,
        request__config__preferred_languages: requestConfig.preferred_languages,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__replaced: logResponse.data.text,
        request__alternative: alternative,
      };

      ph.capture('alternative', {
        ...request,
        response: logResponse,
      });
    },

    async ignoreLog(logResponse: IAlert) {
      const { appID, requestConfig } = await import('./requests');
      ph.session.distinctId = appID;

      const request: IIgnoreLogRequest = {
        request__type: 'ignore',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__primary_language: requestConfig.primary_language,
        request__config__preferred_languages: requestConfig.preferred_languages,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__ignored: logResponse.data.text,
      };

      ph.capture('ignore', {
        ...request,
        response: logResponse,
      });
    },
    async checkLog(logResponse: ILogResponse, inputLength: number) {
      const { appID, requestConfig } = await import('./requests');
      ph.session.distinctId = appID;

      const request: ICheckLogRequest = {
        request__type: 'check',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__primary_language: requestConfig.primary_language,
        request__config__preferred_languages: requestConfig.preferred_languages,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__text__length: inputLength,
      };

      ph.capture('check', {
        ...request,
        response: logResponse,
      });
    },
    async popoverToggleLog(logResponse: IAlert) {
      const { appID, requestConfig } = await import('./requests');
      ph.session.distinctId = appID;

      const request: ILogRequest = {
        request__type: 'popver_open',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__primary_language: requestConfig.primary_language,
        request__config__preferred_languages: requestConfig.preferred_languages,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
      };

      ph.capture('popver_open', {
        ...request,
        response: logResponse,
      });
    },
  };
};
