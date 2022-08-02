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
import { appID, requestConfig } from './requests';

export const useAnalytics = () => {
  const ph = browserPostHog(POSTHOG_API_KEY);

  return {
    async alternativeLog(logResponse: IAlert, alternative: string) {
      ph.session.distinctId = appID;

      const request: IAlternativeLogRequest = {
        request__type: 'alternative',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__replaced: logResponse.data.text,
        request__alternative: alternative,
        response__id: logResponse.id,
        response__startOffset: logResponse.startOffset,
        response__endOffset: logResponse.endOffset,
        response__popOverIsOpen: logResponse.popOverIsOpen,
        response__groupId: logResponse.groupId,
        response__plan: logResponse.plan,
      };

      if (logResponse.groupId) {
        ph.capture('alternative', {
          ...request,
          response: logResponse,
          $groups: {
            organization: logResponse.groupId,
          },
        });
      } else {
        ph.capture('alternative', {
          ...request,
          response: logResponse,
        });
      }
    },

    async checkLog(logResponse: ILogResponse, inputLength: number) {
      ph.session.distinctId = appID;

      const request: ICheckLogRequest = {
        request__type: 'check',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__text__length: inputLength,
        response__groupId: logResponse.organization_config.id,
        response__name: logResponse.organization_config.name,
        response__plan: logResponse.organization_config.plan,
      };

      if (logResponse.organization_config) {
        ph.capture('check', {
          ...request,
          response: logResponse,
          $groups: {
            organization: logResponse.organization_config.id,
          },
        });
      } else {
        ph.capture('check', {
          ...request,
          response: logResponse,
        });
      }
    },

    async ignoreLog(logResponse: IAlert) {
      ph.session.distinctId = appID;

      const request: IIgnoreLogRequest = {
        request__type: 'ignore',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__ignored: logResponse.data.text,
        response__id: logResponse.id,
        response__startOffset: logResponse.startOffset,
        response__endOffset: logResponse.endOffset,
        response__popOverIsOpen: logResponse.popOverIsOpen,
        response__groupId: logResponse.groupId,
        response__plan: logResponse.plan,
      };

      if (logResponse.groupId) {
        ph.capture('ignore', {
          ...request,
          response: logResponse,
          $groups: {
            organization: logResponse.groupId,
          },
        });
      } else {
        ph.capture('ignore', {
          ...request,
          response: logResponse,
        });
      }
    },

    async popoverLogs(logResponse: IAlert, logType: string) {
      ph.session.distinctId = appID;

      const request: ILogRequest = {
        request__type: logType,
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        response__id: logResponse.id,
        response__startOffset: logResponse.startOffset,
        response__endOffset: logResponse.endOffset,
        response__popOverIsOpen: logResponse.popOverIsOpen,
        response__groupId: logResponse.groupId,
        response__plan: logResponse.plan,
      };

      if (logResponse.groupId) {
        ph.capture(logType, {
          ...request,
          response: logResponse,
          $groups: {
            organization: logResponse.groupId,
          },
        });
      } else {
        ph.capture(logType, {
          ...request,
          response: logResponse,
        });
      }
    },

    async extensionStatusLog(status: string, appID: string) {
      ph.session.distinctId = appID;
      ph.capture(status, {
        request__id: appID,
        request__client: wittyVersion,
      });
    },

    async voteForUrlLog(url: string, appID: string) {
      ph.session.distinctId = appID;
      const request: ILogRequest = {
        request__type: 'vote',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
      };
      ph.capture('vote', {
        ...request,
        vote_url: url,
      });
    },
  };
};
