import { IAlert } from '../types';
import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import { POSTHOG_API_KEY_EU, StorageKeys, wittyVersion } from '../constants';
import { browser } from 'webextension-polyfill-ts';
import { storeInLocalStorage } from '../utils';

export const aliasId = async (userId: string, appId: string) => {
    const request = {
      api_key: POSTHOG_API_KEY_EU,
      properties: {
        distinct_id: appId,
        alias: userId,
      },
      timestamp: new Date().toISOString(),
      context: '{}',
      type: 'alias',
      event: '$create_alias',
    };
  
    const response = await fetch('https://eu.posthog.com/capture/', {
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
    const userId = result[StorageKeys.USER_ID];
    const organizationId = result[StorageKeys.ORGANIZATION_ID];
    const idWasAliased = result[StorageKeys.ID_WAS_ALIASED];
    const appId = result[StorageKeys.APP_ID];

    !idWasAliased && userId && aliasId(userId, appId);

    const ph = browserPostHog(POSTHOG_API_KEY_EU, {
      apiHost: 'https://eu.posthog.com',
    });

    ph.session.distinctId = userId ? userId : appId;

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
