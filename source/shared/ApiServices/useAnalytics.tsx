import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import { POSTHOG_API_KEY, wittyVersion } from '../constants';
import { ILog } from '../types';

export const useAnalytics = () => {
  const ph = browserPostHog(POSTHOG_API_KEY);
  return {
    async alternativeLog(...logs: ILog[]) {
      const { appID, requestConfig } = await import("./requests");
      ph.session.distinctId = appID;
      for (const log of logs) {
        ph.capture('alternative', {
          lang: log.language,
          client: wittyVersion,
          config: requestConfig,
          context: log.context,
          start: log.start,
          end: log.end,
          details: log.details,
          text: log.text,
        });
      }
    },
    async ignoreLog(...logs: ILog[]) {
      const { appID, requestConfig } = await import("./requests");
      ph.session.distinctId = appID;
      for (const log of logs) {
        ph.capture('ignore', {
          lang: log.language,
          client: wittyVersion,
          config: requestConfig,
          context: log.context,
          start: log.start,
          end: log.end,
          details: log.details,
          text: log.text,
        });
      }
    },
    async checkLog(...logs: ILog[]) {
      const { appID } = await import("./requests");
      ph.session.distinctId = appID;
      console.error(appID)
      ph.capture('check', { ...logs });
    }
  }
};