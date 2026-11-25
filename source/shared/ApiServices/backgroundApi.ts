import browser from 'webextension-polyfill';

import {
  ApiCancelMessage,
  ApiRequestMessage,
  ApiResponse,
  MessageTypes,
} from '../messages';

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

/** A worker that is still starting can miss the first message. */
const sendWithRetry = async (
  message: ApiRequestMessage,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // Cancelled while waiting to send again: the background never saw the
    // request, so the cancel found nothing to abort.
    if (attempt > 0 && signal?.aborted) return noResponse('AbortError');
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

/**
 * Have the background worker make an API request (Background/apiProxy.ts):
 * it holds the credentials, content scripts do not. When `signal` aborts,
 * the background is asked to cancel the request; a request whose signal has
 * aborted already is not sent.
 *
 * Sending the message wakes a stopped service worker (Chrome) or event page
 * (Firefox), and the pending answer keeps it running until the request is
 * done. A worker that is still starting can miss the first message, so that
 * one is sent again once. Any other failure answers as status 0.
 */
export const backgroundApiRequest = async (
  request: Omit<ApiRequestMessage, 'type' | 'requestId'>,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  if (signal?.aborted) return noResponse('AbortError');
  const message: ApiRequestMessage = {
    type: MessageTypes.API_REQUEST,
    ...request,
    ...(signal ? {requestId: crypto.randomUUID()} : {}),
  };
  const cancel = (): void => {
    const cancelMessage: ApiCancelMessage = {
      type: MessageTypes.API_CANCEL,
      requestId: message.requestId as string,
    };
    // Nothing to do if the worker has gone: the request went with it.
    browser.runtime.sendMessage(cancelMessage).catch(() => undefined);
  };
  // The caller has stopped waiting: it is answered at once, whether or not
  // the background still answers (its cancel can be lost to a restart).
  let stopWaiting = (): void => {};
  const cancelled = new Promise<ApiResponse>((resolve): void => {
    stopWaiting = (): void => resolve(noResponse('AbortError'));
  });
  const onAbort = (): void => {
    cancel();
    stopWaiting();
  };
  signal?.addEventListener('abort', onAbort, {once: true});
  try {
    return await Promise.race([sendWithRetry(message, signal), cancelled]);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
};
