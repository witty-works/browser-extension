import { IAlert } from '../types';
import { appID, requestConfig } from './requests';
import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import {
  POSTHOG_API_KEY_EU,
  POSTHOG_API_KEY_US,
  StorageKeys,
  wittyVersion,
} from '../constants';
import { browser } from 'webextension-polyfill-ts';

export const captureEvent = (
  eventName: string,
  eventData: object,
  isEuInstance: boolean
) => {
  browser.storage.local.get().then((result) => {
    const userId = result[StorageKeys.USER_ID];
    const organizationId = result[StorageKeys.ORGANIZATION_ID];
    const apiKey = getApiKeyByInstance(isEuInstance);

    const ph = browserPostHog(apiKey ? apiKey : '', {
      apiHost: isEuInstance
        ? 'https://eu.posthog.com'
        : 'https://app.posthog.com',
    });

    ph.session.distinctId = isEuInstance ? userId : appID;

    if (organizationId && isEuInstance) {
      ph.capture(eventName, {
        ...eventData,
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

export const getApiKeyByInstance = (isEuInstance: boolean) => {
  const apiKey = isEuInstance ? POSTHOG_API_KEY_EU : POSTHOG_API_KEY_US;
  return apiKey;
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
    response__data_text: logResponse.data.text,
    response__data__label: logResponse.data.label,
    response__data__explanation__text:
      logResponse.data.explanation && logResponse.data.explanation.text,
    response__data__explanation__icon:
      logResponse.data.explanation && logResponse.data.explanation.icon,
    response__data__explanation__url:
      logResponse.data.explanation && logResponse.data.explanation.url,
    response__data__alternatives: logResponse.data.alternatives,
    response__data__gravity: logResponse.data.gravity,
  };
};

export const getRequestData = () => {
  return {
    request__lang: 'auto',
    request__client: wittyVersion,
    request__config__preferred_variants: requestConfig.preferred_variants,
    request__config__german_gender_ending: requestConfig.german_gender_ending,
  };
};
