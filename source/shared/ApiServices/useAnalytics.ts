import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import { POSTHOG_API_KEY, wittyVersion } from '../constants';
import {
  IAlert,
  ILogResponse,
  IVoteLogRequest,
  IAlternativeLogItems,
  ICheckLogItems,
  IIgnoreLogItems,
  ILogItems,
} from '../types';
import { appID, requestConfig } from './requests';

export const useAnalytics = () => {
  const ph = browserPostHog(POSTHOG_API_KEY);

  return {
    async alternativeLog(logResponse: IAlert, alternative: string) {
      ph.session.distinctId = appID;

      const alternativeLogItems: IAlternativeLogItems = {
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
        response__data__language: logResponse.data.language,
        response__data__category: logResponse.data.category,
        response__data__subcategory: logResponse.data.subcategory,
        response__data__context: logResponse.data.context,
        response__data_text: logResponse.data.text,
        response__data__label: logResponse.data.label,
        response__data__explanation: logResponse.data.explanation,
        response__data__explanation__text: logResponse.data.explanation.text,
        response__data__explanation__icon: logResponse.data.explanation.icon,
        response__data__explanation__url: logResponse.data.explanation.url,
        response__data__alternatives: logResponse.data.alternatives,
        response__data__gravity: logResponse.data.gravity,
      };

      if (logResponse.groupId) {
        ph.capture('alternative', {
          ...alternativeLogItems,
          $groups: {
            organization: logResponse.groupId,
          },
        });
      } else {
        ph.capture('alternative', {
          ...alternativeLogItems,
        });
      }
    },

    async checkLog(logResponse: ILogResponse, inputLength: number) {
      ph.session.distinctId = appID;

      const checkLogItems: ICheckLogItems = {
        request__type: 'check',
        request__lang: 'auto',
        request__id: appID,
        request__client: wittyVersion,
        request__config__preferred_variants: requestConfig.preferred_variants,
        request__config__german_gender_ending:
          requestConfig.german_gender_ending,
        request__text__length: inputLength,
        response__results: logResponse.results,
        response__language: logResponse.language,
        response__limit_reached: logResponse.limit_reached,
        response__groupId: logResponse.organization_config.id,
        response__name: logResponse.organization_config.name,
        response__plan: logResponse.organization_config.plan,
      };

      if (logResponse.organization_config) {
        ph.capture('check', {
          ...checkLogItems,
          $groups: {
            organization: logResponse.organization_config.id,
          },
        });
      } else {
        ph.capture('check', {
          ...checkLogItems,
        });
      }
    },

    async ignoreLog(logResponse: IAlert) {
      ph.session.distinctId = appID;

      const ignoreLogItems: IIgnoreLogItems = {
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
        response__data__language: logResponse.data.language,
        response__data__category: logResponse.data.category,
        response__data__subcategory: logResponse.data.subcategory,
        response__data__context: logResponse.data.context,
        response__data_text: logResponse.data.text,
        response__data__label: logResponse.data.label,
        response__data__explanation: logResponse.data.explanation,
        response__data__explanation__text: logResponse.data.explanation.text,
        response__data__explanation__icon: logResponse.data.explanation.icon,
        response__data__explanation__url: logResponse.data.explanation.url,
        response__data__alternatives: logResponse.data.alternatives,
        response__data__gravity: logResponse.data.gravity,
      };

      if (logResponse.groupId) {
        ph.capture('ignore', {
          ...ignoreLogItems,
          $groups: {
            organization: logResponse.groupId,
          },
        });
      } else {
        ph.capture('ignore', {
          ...ignoreLogItems,
        });
      }
    },

    async popoverLogs(logResponse: IAlert, logType: string) {
      ph.session.distinctId = appID;

      const popoverLogItems: ILogItems = {
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
        response__data__language: logResponse.data.language,
        response__data__category: logResponse.data.category,
        response__data__subcategory: logResponse.data.subcategory,
        response__data__context: logResponse.data.context,
        response__data_text: logResponse.data.text,
        response__data__label: logResponse.data.label,
        response__data__explanation: logResponse.data.explanation,
        response__data__explanation__text: logResponse.data.explanation.text,
        response__data__explanation__icon: logResponse.data.explanation.icon,
        response__data__explanation__url: logResponse.data.explanation.url,
        response__data__alternatives: logResponse.data.alternatives,
        response__data__gravity: logResponse.data.gravity,
      };

      if (logResponse.groupId) {
        ph.capture(logType, {
          ...popoverLogItems,
          $groups: {
            organization: logResponse.groupId,
          },
        });
      } else {
        ph.capture(logType, {
          ...popoverLogItems,
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
      const request: IVoteLogRequest = {
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
