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
  ICheckResultLogItems,
  ICheckResponseResult,
  IFeatureFlagItems,
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
      requestType: string,
      checkLogEventId: string,
    ) {
      const checkResponseResultsWithoutContext = checkResponse.results.map(
        (result) => {
          const { context, ...resultWithoutContext } = result;
          return resultWithoutContext;
        },
      ) as ICheckResponseResult[];

      const checkLogItems: ICheckLogItems = {
        request__id: checkLogEventId,
        request__type: requestType,
        request__text__length: inputLength,
        ...getRequestData(),
        response__data__language: checkResponse.language,
        response__limit_reached: checkResponse.limit_reached,
        response__organizationId: authResponse
          ? authResponse.organization_id
          : undefined,
        response__plan: authResponse ? authResponse.plan : undefined,
        response__results: checkResponseResultsWithoutContext,
      };

      captureEvent(requestType, checkLogItems);
    },

    async checkResultLog(
      checkResponse: ICheckResponseResult,
      authResponse: IAuthResponse | null,
      inputLength: number,
      requestType: string,
      checkLogEventId: string,
    ) {
      const checkLogItems: ICheckResultLogItems = {
        request__id: checkLogEventId,
        request__type: requestType,
        request__text__length: inputLength,
        ...getRequestData(),
        response__limit_reached: checkResponse.limit_reached,
        response__organizationId: authResponse
          ? authResponse.organization_id
          : undefined,
        response__plan: authResponse ? authResponse.plan : undefined,
        response__data__text: checkResponse.text_id,
        response__data__text__matched: checkResponse.text,
        response__data__category: checkResponse.category,
        response__data__subcategory: checkResponse.subcategory,
        response__startOffset: checkResponse.start,
        response__endOffset: checkResponse.end,
        response__data__label: checkResponse.label,
        response__data__explanation__text: checkResponse.explanation?.text,
        response__data__explanation__icon: checkResponse.explanation?.icon,
        response__data__explanation__url: checkResponse.explanation?.url,
        response__data__alternatives: checkResponse.alternatives,
        response__data__gravity: checkResponse.gravity,
        response__data__language:  checkResponse.language,
      };

      captureEvent(requestType, checkLogItems);
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

    async featureFlagLog(flagName: string, accepted: boolean) {
      const featureFlagItems: IFeatureFlagItems = {
        request__type: 'feature_flag',
        flag__name: flagName,
        flag__accepted: accepted, //true if action button clicked, false if x clicked
        ...getRequestData(),
      };
      captureEvent('feature_flag', featureFlagItems);
    }
  };
};
