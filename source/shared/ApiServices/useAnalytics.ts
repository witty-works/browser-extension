import {
  IAlert,
  ILogResponse,
  IVoteLogRequest,
  IAlternativeLogItems,
  ICheckLogItems,
  IIgnoreLogItems,
  ILogItems,
} from '../types';
import {
  captureEvent,
  getRequestData,
  getResponseData,
} from './analyticsUtils';
import { appID } from './requests';

export const useAnalytics = () => {
  return {
    async checkLog(logResponse: ILogResponse, inputLength: number) {
      const checkLogItems: ICheckLogItems = {
        request__type: 'check',
        request__text__length: inputLength,
        ...getRequestData(appID),
        response__results: logResponse.results,
        response__language: logResponse.language,
        response__limit_reached: logResponse.limit_reached,
        response__groupId: logResponse.organization_config
          ? logResponse.organization_config.id
          : null,
        response__name: logResponse.organization_config
          ? logResponse.organization_config.name
          : null,
        response__plan: logResponse.organization_config
          ? logResponse.organization_config.plan
          : null,
      };

      captureEvent(
        'check',
        checkLogItems,
        logResponse.organization_config
          ? logResponse.organization_config.id
          : null
      );
    },

    async alternativeLog(logResponse: IAlert, alternative: string) {
      const alternativeLogItems: IAlternativeLogItems = {
        request__type: 'alternative',
        request__replaced: logResponse.data.text,
        request__alternative: alternative,
        ...getRequestData(appID),
        ...getResponseData(logResponse),
      };

      captureEvent('alternative', alternativeLogItems, logResponse.groupId);
    },

    async ignoreLog(logResponse: IAlert) {
      const ignoreLogItems: IIgnoreLogItems = {
        request__type: 'ignore',
        request__ignored: logResponse.data.text,
        ...getRequestData(appID),
        ...getResponseData(logResponse),
      };

      captureEvent('ignore', ignoreLogItems, logResponse.groupId);
    },

    async popoverLogs(logResponse: IAlert, logType: string) {
      const popoverLogItems: ILogItems = {
        request__type: logType,
        ...getRequestData(appID),
        ...getResponseData(logResponse),
      };

      captureEvent(logType, popoverLogItems, logResponse.groupId);
    },

    async extensionInstallationAndUpdateLog(status: string, appID: string) {
      captureEvent(status, getRequestData(appID), null);
    },

    async extenstionStatusLog(status: string) {
      captureEvent(status, getRequestData(appID), null);
    },

    async voteForUrlLog(url: string, appID: string) {
      const voteItems: IVoteLogRequest = {
        request__type: 'vote',
        vote__url: url,
        ...getRequestData(appID),
      };
      captureEvent('vote', voteItems, null);
    },
  };
};
