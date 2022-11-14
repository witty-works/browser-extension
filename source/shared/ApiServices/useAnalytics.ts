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
      inputLength: number,
      isEuInstance: boolean
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

      captureEvent('check', checkLogItems, isEuInstance);
    },

    async alternativeLog(
      logResponse: IAlert,
      alternative: string,
      isEuInstance: boolean
    ) {
      const alternativeLogItems: IAlternativeLogItems = {
        request__type: 'alternative',
        request__alternative: alternative,
        ...getRequestData(),
        ...getResponseData(logResponse),
      };

      captureEvent('alternative', alternativeLogItems, isEuInstance);
    },

    async ignoreLog(logResponse: IAlert, isEuInstance: boolean) {
      const ignoreLogItems: IIgnoreLogItems = {
        request__type: 'ignore',
        ...getRequestData(),
        ...getResponseData(logResponse),
      };

      captureEvent('ignore', ignoreLogItems, isEuInstance);
    },

    async popoverLogs(
      logResponse: IAlert,
      logType: string,
      isEuInstance: boolean
    ) {
      const popoverLogItems: ILogItems = {
        request__type: logType,
        ...getRequestData(),
        ...getResponseData(logResponse),
      };

      captureEvent(logType, popoverLogItems, isEuInstance);
    },

    async extenstionStatusLog(status: string, isEuInstance: boolean) {
      captureEvent(status, getRequestData(), isEuInstance);
    },

    async urlLog(url: string, type: string, isEuInstance: boolean) {
      const voteItems: IVoteLogRequest = {
        request__type: 'vote',
        vote__url: url,
        ...getRequestData(),
      };
      captureEvent(type, voteItems, isEuInstance);
    },

    async dashboardLog(location: string, isEuInstance: boolean) {
      const dashboardItems: IDashboardLogRequest = {
        request__type: 'dashboard',
        dashboard__location: location,
        ...getRequestData(),
      };
      captureEvent('dashboard', dashboardItems, isEuInstance);
    },

    async extensionInstallationAndUpdateLog(
      status: string,
      isEuInstance: boolean
    ) {
      captureEvent(status, getRequestData(), isEuInstance);
    },
  };
};
