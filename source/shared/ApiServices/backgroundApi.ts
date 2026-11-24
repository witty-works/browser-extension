import browser from 'webextension-polyfill';

import {ApiRequestMessage, ApiResponse, MessageTypes} from '../messages';

/** Chrome's answer while the service worker is not listening yet. */
const NOT_LISTENING =
  /Receiving end does not exist|Could not establish connection/i;

const noResponse = (statusText: string): ApiResponse => {
  return {
    ok: false,
    status: 0,
    statusText,
    data: null,
  };
};

const isApiResponse = (value: unknown): value is ApiResponse =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ApiResponse).status === 'number' &&
  typeof (value as ApiResponse).ok === 'boolean';

/**
 * Have the background worker make an API request (Background/apiProxy.ts):
 * it holds the credentials, content scripts do not.
 *
 * Sending the message wakes a stopped service worker (Chrome) or event page
 * (Firefox), and the pending answer keeps it running until the request is
 * done. A worker that is still starting can miss the first message, so that
 * one is sent again once. Any other failure answers as status 0.
 */
export const backgroundApiRequest = async (
  request: Omit<ApiRequestMessage, 'type'>
): Promise<ApiResponse> => {
  const message: ApiRequestMessage = {
    type: MessageTypes.API_REQUEST,
    ...request,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await browser.runtime.sendMessage(message);
      return isApiResponse(response) ? response : noResponse('No answer');
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (attempt > 0 || !NOT_LISTENING.test(text)) return noResponse(text);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return noResponse('No answer');
};
