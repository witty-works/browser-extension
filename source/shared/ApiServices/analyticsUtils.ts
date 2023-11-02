import { IAlert } from '../types';
import PostHog from 'posthog-js-lite'
import { POSTHOG_API_URL, POSTHOG_API_KEY, StorageKeys, wittyVersion } from '../constants';
import { browser } from 'webextension-polyfill-ts';
import { storeInLocalStorage } from '../utils';
import defaultConfig from '../../witty.config.json';
export const aliasId = async (userId: string, appId: string) => {
    const request = {
      api_key: POSTHOG_API_KEY,
      properties: {
        distinct_id: appId,
        alias: userId,
      },
      timestamp: new Date().toISOString(),
      context: '{}',
      type: 'alias',
      event: '$create_alias',
    };
  
    const response = await fetch(POSTHOG_API_URL + '/capture/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (response && response.status === 200) {
      storeInLocalStorage(StorageKeys.ID_WAS_ALIASED, true);
    }
};

export const captureEvent = (eventName: string, eventData: object) => {
  browser.storage.local.get().then((result) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      
      let dailyPosthogEventsUsed = result[StorageKeys.DAILY_POSTHOG_EVENTS_USED];
      let lastCheckEventTime = result[StorageKeys.LAST_CHECK_EVENT_TIME];

      if (!dailyPosthogEventsUsed || dailyPosthogEventsUsed.date !== today) {
        dailyPosthogEventsUsed = { date: today, count: 0 };
      }
      
      if (eventName === 'check') {
        const lastLoggedHour = lastCheckEventTime ? new Date(lastCheckEventTime).getHours() : null;

        if (lastLoggedHour !== null && currentHour === lastLoggedHour) {
          return;
        }
        browser.storage.local.set({ [StorageKeys.LAST_CHECK_EVENT_TIME]: now.toISOString() });
      }
      
      if (parseInt(dailyPosthogEventsUsed.count) >= defaultConfig.MAX_POSTHOG_LOG_EVENTS) {
        return;
      } else {
        dailyPosthogEventsUsed.count = dailyPosthogEventsUsed.count ? parseInt(dailyPosthogEventsUsed.count) + 1 : 1;
        storeInLocalStorage(StorageKeys.DAILY_POSTHOG_EVENTS_USED, dailyPosthogEventsUsed);
      }
      
      const userId = result[StorageKeys.USER_ID];
      const organizationId = result[StorageKeys.ORGANIZATION_ID];
      const idWasAliased = result[StorageKeys.ID_WAS_ALIASED];
      const appId = result[StorageKeys.APP_ID];
      const featureFlags = [
        {
          flag: 'sales-demo-feature-flag',
          storageKey: StorageKeys.SALES_DEMO_FEATURE_FLAG
        },
        {
          flag: 'invite-team-feature-flag',
          storageKey: StorageKeys.INVITE_TEAM_FEATURE_FLAG
        },
        {
          flag: 'invite-friends-feature-flag',
          storageKey: StorageKeys.INVITE_FRIENDS_FEATURE_FLAG
        },
      ];

          if (!idWasAliased && userId) {
            aliasId(userId, appId);
          }

      const ph = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_API_URL,
        bootstrap : {
          distinctId: userId ? userId : appId, ////make sure that this is equivalent to ph.session.distinctId
        },
      })

      function storeEnabledFeatureFlags() {
        for (const featureFlag of featureFlags) {
          storeInLocalStorage(featureFlag.storageKey, ph.getFeatureFlagPayload(featureFlag.flag));
        }
      }
      
      ph.onFeatureFlags(storeEnabledFeatureFlags); // Ensure flags are loaded before usage.
      storeEnabledFeatureFlags();

      if (organizationId) {
        ph.capture(eventName, {
          ...eventData,
          request__app_id: appId,
          $groups: {
            organization: organizationId,
          },
        });
      } else {
        ph.capture(eventName, {
          ...eventData,
        });
      }
    }
    catch (e) {
      console.log(e);
    }
  });
};

export const getResponseData = (logResponse: IAlert) => {
  return {
    response__id: logResponse.id,
    response__organizationId: logResponse.organizationId,
    response__startOffset: logResponse.startOffset,
    response__endOffset: logResponse.endOffset,
    response__popOverIsOpen: logResponse.popOverIsOpen,
    response__plan: logResponse.plan,
    response__data__language: logResponse.data.language,
    response__data__category: logResponse.data.category,
    response__data__subcategory: logResponse.data.subcategory,
    response__data__context: logResponse.data.context,
    response__data__text: logResponse.data.text,
    response__data__label: logResponse.data.label,
    response__data__explanation__text: logResponse.data.explanation?.text,
    response__data__explanation__icon: logResponse.data.explanation?.icon,
    response__data__explanation__url: logResponse.data.explanation?.url,
    response__data__alternatives: logResponse.data.alternatives,
    response__data__gravity: logResponse.data.gravity,
  };
};

export const getRequestData = () => {
  return {
    request__lang: 'auto',
    request__client: wittyVersion,
  };
};
