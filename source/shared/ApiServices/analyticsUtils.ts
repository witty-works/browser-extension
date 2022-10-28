import { IAlert } from '../types';
import { wittyVersion } from '../constants';
import { requestConfig } from './requests';
import { browserPostHog } from 'posthog-js-lite/dist/src/targets/browser';
import { POSTHOG_API_KEY } from '../constants';

const ph = browserPostHog(POSTHOG_API_KEY);

export const captureEvent = (
  eventName: string,
  eventData: object,
  groupId: string | null | undefined
) => {
  if (groupId) {
    ph.capture(eventName, {
      ...eventData,
      $groups: {
        organization: groupId,
      },
    });
  } else {
    ph.capture(eventName, {
      ...eventData,
    });
  }
};

export const getResponseData = (logResponse: IAlert) => {
  return {
    response__id: logResponse.id,
    response__startOffset: logResponse.startOffset,
    response__endOffset: logResponse.endOffset,
    response__popOverIsOpen: logResponse.popOverIsOpen,
    response__groupId: logResponse.groupId,
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

export const getRequestData = (appID: string) => {
  ph.session.distinctId = appID;
  return {
    request__lang: 'auto',
    request__id: appID,
    request__client: wittyVersion,
    request__config__preferred_variants: requestConfig.preferred_variants,
    request__config__german_gender_ending: requestConfig.german_gender_ending,
  };
};
