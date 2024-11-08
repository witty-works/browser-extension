import {logTypes, useLog} from "../customHooks/useLog";
import {useAnalytics} from "./useAnalytics";
import {IAuthResponse, ICheckResponse} from "../types";
import {useStateRef} from "../customHooks/useStateRef";

export const useCheckEventsLogger = (authResponse: IAuthResponse | null, hrFeatureDisabled: boolean) => {
  const analytics = useAnalytics();
  const log = useLog('CheckEventsLogger');

  const [, , checkLogEventIdRef] = useStateRef<string>('');

  return {
    checkLog(checkEndpointResponse: ICheckResponse, textContentLength: number) {
      checkLogEventIdRef.current = Math.random().toString(36).substring(2, 15);
      analytics.checkLog(
        checkEndpointResponse,
        authResponse,
        textContentLength,
        'check',
        checkLogEventIdRef.current,
        hrFeatureDisabled
      );
      log(
        `Results: Language is ${checkEndpointResponse.language.toUpperCase()} and the relevant terms are: `,
        logTypes.INFO,
        checkEndpointResponse.results.length > 0
          ? checkEndpointResponse.results
          : 'None'
      );
    },

    logNewCheckResponses(checkEndpointResponse: ICheckResponse, textContentLength: number)  {
      const checkEndpointResponseWithoutOrthography = {
        ...checkEndpointResponse,
        results: checkEndpointResponse.results.filter((result: any) => {
          return result.data?.category !== 'orthography';
        }),
      };

      if (checkEndpointResponseWithoutOrthography.results.length === 0) return;

      for (const result of checkEndpointResponseWithoutOrthography.results) {
        result && analytics.checkResultLog(
          result,
          authResponse,
          textContentLength,
          'check_highlights',
          checkLogEventIdRef.current,
          hrFeatureDisabled
        );
      }
    },
  }
};
