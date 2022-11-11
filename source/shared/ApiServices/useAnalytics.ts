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
import { appID } from './requests';

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
        ...getRequestData(appID),
        response__results: checkResponse.results,
        response__language: checkResponse.language,
        response__limit_reached: checkResponse.limit_reached,
        response__organizationId: authResponse
          ? authResponse.organization_id
          : undefined,
        response__name: authResponse ? authResponse.name : undefined,
        response__plan: authResponse ? authResponse.plan : undefined,
      };

      captureEvent(
        'check',
        checkLogItems,
        authResponse ? authResponse.id : null
      );
    },

    async alternativeLog(logResponse: IAlert, alternative: string) {
      const alternativeLogItems: IAlternativeLogItems = {
        request__type: 'alternative',
        request__alternative: alternative,
        ...getRequestData(appID),
        ...getResponseData(logResponse),
      };

      captureEvent(
        'alternative',
        alternativeLogItems,
        logResponse.organizationId
      );
    },

    async ignoreLog(logResponse: IAlert) {
      const ignoreLogItems: IIgnoreLogItems = {
        request__type: 'ignore',
        ...getRequestData(appID),
        ...getResponseData(logResponse),
      };

      captureEvent('ignore', ignoreLogItems, logResponse.organizationId);
    },

    async popoverLogs(logResponse: IAlert, logType: string) {
      const popoverLogItems: ILogItems = {
        request__type: logType,
        ...getRequestData(appID),
        ...getResponseData(logResponse),
      };

      captureEvent(logType, popoverLogItems, logResponse.organizationId);
    },

    async extensionInstallationAndUpdateLog(status: string, appID: string) {
      captureEvent(status, getRequestData(appID), null);
    },

    async extenstionStatusLog(status: string) {
      captureEvent(status, getRequestData(appID), null);
    },

    async urlLog(url: string, appID: string, type: string) {
      const voteItems: IVoteLogRequest = {
        request__type: 'vote',
        vote__url: url,
        ...getRequestData(appID),
      };
      captureEvent(type, voteItems, null);
    },

    async dashboardLog(location: string, appID: string) {
      const dashboardItems: IDashboardLogRequest = {
        request__type: 'dashboard',
        dashboard__location: location,
        ...getRequestData(appID),
      };
      captureEvent('dashboard', dashboardItems, null);
    },
  };
};
