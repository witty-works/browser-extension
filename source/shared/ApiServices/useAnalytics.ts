import {
  IAlert,
  IVoteLogRequest,
  IAlternativeLogItems,
  ICheckLogItems,
  IIgnoreLogItems,
  ILogItems,
  IAuthResponse,
  ICheckResponse,
  IDashboardLogRequest,
} from '../types';
import {
  captureEvent,
  getRequestData,
  getResponseData,
} from './analyticsUtils';

export const useAnalytics = () => {
  return {
    async checkLog(
      checkResponse: ICheckResponse,
      authResponse: IAuthResponse | null,
      inputLength: number
    ) {
      const checkLogItems: ICheckLogItems = {
        request__type: 'check',
        request__text__length: inputLength,
        ...getRequestData(),
        response__results: checkResponse.results,
        response__language: checkResponse.language,
        response__limit_reached: checkResponse.limit_reached,
        response__organizationId: authResponse
          ? authResponse.organization_id
          : undefined,
        response__name: authResponse ? authResponse.name : undefined,
        response__plan: authResponse ? authResponse.plan : undefined,
      };

      captureEvent('check', checkLogItems);
    },

    async alternativeLog(logResponse: IAlert, alternative: string) {
      const alternativeLogItems: IAlternativeLogItems = {
        request__type: 'alternative',
        request__alternative: alternative,
        ...getRequestData(),
        ...getResponseData(logResponse),
      };

      captureEvent('alternative', alternativeLogItems);
    },

    async ignoreLog(logResponse: IAlert) {
      const ignoreLogItems: IIgnoreLogItems = {
        request__type: 'ignore',
        ...getRequestData(),
        ...getResponseData(logResponse),
      };

      captureEvent('ignore', ignoreLogItems);
    },

    async popoverLogs(logResponse: IAlert, logType: string) {
      const popoverLogItems: ILogItems = {
        request__type: logType,
        ...getRequestData(),
        ...getResponseData(logResponse),
      };

      captureEvent(logType, popoverLogItems);
    },

    async extenstionStatusLog(status: string) {
      captureEvent(status, getRequestData());
    },

    async urlLog(url: string, type: string) {
      const voteItems: IVoteLogRequest = {
        request__type: 'vote',
        vote__url: url,
        ...getRequestData(),
      };
      captureEvent(type, voteItems);
    },

    async dashboardLog(buttonLocation: string) {
      const dashboardItems: IDashboardLogRequest = {
        request__type: 'dashboard_open',
        button__location: buttonLocation,
        ...getRequestData(),
      };
      captureEvent('dashboard_open', dashboardItems);
    },

    async extensionInstallationAndUpdateLog(status: string) {
      captureEvent(status, getRequestData());
    },

    async maxCharLengthReachedLog(eventName: string) {
      captureEvent(eventName, getRequestData());
    },
  };
};
