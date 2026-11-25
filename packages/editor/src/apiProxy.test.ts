// @vitest-environment happy-dom
// The extension's background API proxy (source/Background/apiProxy.ts) and
// the message check in front of it (source/shared/messages.ts), against an
// in-memory storage and a mocked network. With the editor's unit tests
// because they are the repository's only unit test suite.
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  cancelApiRequest,
  proxyApiRequest,
} from '../../../source/Background/apiProxy';
import {backgroundApiRequest} from '@witty/core/ApiServices/backgroundApi';
import browser from 'webextension-polyfill';
import {logOut} from '@witty/core/utils';
import {
  type ApiRequestMessage,
  isWittyMessage,
  MessageTypes,
} from '@witty/core/messages';
import {registerStorage, type StorageArea} from '@witty/core/platform/storage';

vi.mock('webextension-polyfill', () => {
  return {
    default: {
      action: {setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn()},
      runtime: {sendMessage: vi.fn()},
    },
  };
});

const API = 'https://api.custom.example/';
const DASHBOARD = 'https://dashboard.custom.example/';

const memoryArea = (): StorageArea & {data: Record<string, unknown>} => {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (keys) => {
      if (keys === null || keys === undefined) return {...data};
      const names = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : Object.keys(keys);
      return Object.fromEntries(
        names.filter((key) => key in data).map((key) => [key, data[key]])
      );
    },
    set: async (items) => {
      Object.assign(data, items);
    },
  };
};

interface Sent {
  url: string;
  method: string;
  authorization?: string;
  xKey?: string;
  body?: unknown;
}

let local: ReturnType<typeof memoryArea>;
let session: ReturnType<typeof memoryArea>;
let sent: Sent[];
let tokenRequests: number;
/** How the API answers a request with the given bearer token. */
let apiAnswer: (authorization: string | undefined) => Response;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });

const check = {kind: 'check' as const, body: {text: 'Hey guys', id: 'x'}};

beforeEach(() => {
  local = memoryArea();
  session = memoryArea();
  registerStorage({
    local,
    session,
    onChanged: {addListener: vi.fn(), removeListener: vi.fn()},
  });
  Object.assign(local.data, {
    apiEndpoint: 'Custom',
    customEndpoint: {
      api: API,
      dashboard: DASHBOARD,
      oauth_client_id: 'client',
      posthog_url: '',
      posthog_key: '',
    },
    refreshToken: 'refresh-1',
    signedIn: true,
  });
  session.data.accessToken = 'access-1';

  sent = [];
  tokenRequests = 0;
  apiAnswer = () => json(200, {results: []});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === `${DASHBOARD}oauth/token`) {
        tokenRequests += 1;
        return json(200, {
          access_token: `access-${tokenRequests + 1}`,
          refresh_token: `refresh-${tokenRequests + 1}`,
          expires_in: 3600,
        });
      }
      const headers = init.headers as Record<string, string>;
      sent.push({
        url,
        method: String(init.method),
        authorization: headers.Authorization,
        xKey: headers['x-key'],
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return apiAnswer(headers.Authorization);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proxyApiRequest', () => {
  it('remembers a token refused after a refresh across a worker restart', async () => {
    // The API does not let this user in (403): one refresh, then no more,
    // also after the service worker stopped and started again.
    apiAnswer = () => json(403, {detail: 'not let in'});
    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
    expect(tokenRequests).toBe(1);

    // Kept in storage.session, which outlives the worker, not in memory.
    expect(session.data.refusedAfterRefresh).toEqual(
      expect.objectContaining({token: 'access-2'})
    );

    // As after a restart: only the stored value says it was refused.
    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
    expect(tokenRequests).toBe(1);
  });

  it('refreshes first when the session has lost the access token', async () => {
    // A browser restart or an extension update empties storage.session, while
    // the refresh token and signedIn stay in storage.local.
    delete session.data.accessToken;
    apiAnswer = (authorization) =>
      authorization
        ? json(200, {results: []})
        : json(401, {detail: 'no token'});

    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      ...check,
    });

    expect(tokenRequests).toBe(1);
    expect(response.ok).toBe(true);
    expect(sent.at(-1)!.authorization).toBe('Bearer access-2');
    expect(sent.every((request) => request.authorization)).toBe(true);
  });

  it('sends nothing with no token and no refresh token', async () => {
    delete session.data.accessToken;
    local.data.refreshToken = '';
    apiAnswer = () => json(401, {detail: 'no token'});

    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      ...check,
    });

    expect(tokenRequests).toBe(0);
    expect(response.status).toBe(401);
  });

  it('sends a check to the stored endpoint with the stored token', async () => {
    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      ...check,
    });

    expect(response).toEqual({
      ok: true,
      status: 200,
      statusText: '',
      data: {results: []},
    });
    expect(sent).toEqual([
      {
        url: `${API}v2.4/check`,
        method: 'POST',
        authorization: 'Bearer access-1',
        xKey: undefined,
        body: check.body,
      },
    ]);
  });

  it('refreshes a refused token once and retries with the new one', async () => {
    apiAnswer = (authorization) =>
      authorization === 'Bearer access-1'
        ? new Response('', {status: 401})
        : json(200, {results: []});

    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      ...check,
    });

    expect(response.status).toBe(200);
    expect(tokenRequests).toBe(1);
    expect(sent.map((request) => request.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('refreshes again once the refused token has expired', async () => {
    // A transient refusal must not block refreshes for the rest of the
    // browser session.
    apiAnswer = () => json(403, {detail: 'not let in'});
    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
    expect(tokenRequests).toBe(1);

    vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
    try {
      await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
      expect(tokenRequests).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets the refused token on sign-out', async () => {
    apiAnswer = () => json(403, {detail: 'not let in'});
    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
    expect(session.data.refusedAfterRefresh).toBeTruthy();

    await logOut();
    expect(session.data.refusedAfterRefresh ?? null).toBeNull();
  });

  it('writes no marker on a success when none is stored', async () => {
    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
    expect('refusedAfterRefresh' in session.data).toBe(false);
  });

  it('does not refresh again for a token refused right after a refresh', async () => {
    apiAnswer = () => new Response('', {status: 403});

    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});
    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});

    expect(tokenRequests).toBe(1);
    expect(sent.map((request) => request.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
      'Bearer access-2',
    ]);
  });

  it('sends no credentials while the stored endpoint is unknown', async () => {
    local.data.apiEndpoint = 'GoneEndpoint';

    await proxyApiRequest({type: MessageTypes.API_REQUEST, ...check});

    expect(sent).toHaveLength(1);
    expect(sent[0].authorization).toBeUndefined();
    expect(sent[0].xKey).toBeUndefined();
    expect(sent[0].url.startsWith(API)).toBe(false);
  });

  it('sends the API key, not the token, in API-key mode', async () => {
    Object.assign(local.data, {
      authMode: 'apiKey',
      apiKey: {endpoint: 'Custom', value: 'key-1'},
    });

    await proxyApiRequest({type: MessageTypes.API_REQUEST, kind: 'auth'});

    expect(sent).toEqual([
      {
        url: `${API}v2.0/auth`,
        method: 'POST',
        authorization: undefined,
        xKey: 'key-1',
        body: undefined,
      },
    ]);
  });

  it('puts an encoded ignore term to the dashboard', async () => {
    apiAnswer = () => new Response(null, {status: 204});

    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      kind: 'ignoreWord',
      term: 'Q&A #1',
    });

    expect(response).toMatchObject({ok: true, status: 204, data: null});
    expect(sent[0].method).toBe('PUT');
    expect(new URL(sent[0].url).searchParams.get('false_positive')).toBe(
      'Q&A #1'
    );
    expect(sent[0].url.startsWith(`${DASHBOARD}api/user/language/`)).toBe(true);
  });

  it('sends no ignore term in API-key mode, which has no dashboard', async () => {
    Object.assign(local.data, {
      authMode: 'apiKey',
      apiKey: {endpoint: 'Custom', value: 'key-1'},
    });

    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      kind: 'ignoreWord',
      term: 'guys',
    });

    expect(response.status).toBe(0);
    expect(sent).toEqual([]);
  });

  it('answers a network error as status 0', async () => {
    apiAnswer = () => {
      throw new TypeError('Failed to fetch');
    };

    const response = await proxyApiRequest({
      type: MessageTypes.API_REQUEST,
      ...check,
    });

    expect(response).toMatchObject({ok: false, status: 0, data: null});
  });
});

describe('API request messages', () => {
  const message = (fields: Record<string, unknown>) => {
    return {
      type: MessageTypes.API_REQUEST,
      ...fields,
    };
  };

  it('accepts the known requests', () => {
    expect(isWittyMessage(message(check))).toBe(true);
    expect(isWittyMessage(message({kind: 'auth'}))).toBe(true);
    expect(
      isWittyMessage(message({kind: 'rephrase', body: {sentence: 'x'}}))
    ).toBe(true);
    expect(isWittyMessage(message({kind: 'ignoreWord', term: 'guys'}))).toBe(
      true
    );
  });

  it('refuses anything else', () => {
    expect(isWittyMessage(message({kind: 'fetch', url: 'https://x/'}))).toBe(
      false
    );
    expect(isWittyMessage(message({kind: 'check'}))).toBe(false);
    expect(isWittyMessage(message({kind: 'check', body: 'text'}))).toBe(false);
    expect(isWittyMessage(message({kind: 'ignoreWord', term: ''}))).toBe(false);
    expect(
      isWittyMessage(message({kind: 'ignoreWord', term: 'x'.repeat(201)}))
    ).toBe(false);
    expect(isWittyMessage(message({...check, requestId: 7}))).toBe(false);
    expect(isWittyMessage(message({...check, requestId: 'x'.repeat(65)}))).toBe(
      false
    );
  });

  it('accepts a request id and a cancel for one', () => {
    expect(isWittyMessage(message({...check, requestId: 'r1'}))).toBe(true);
    expect(
      isWittyMessage({type: MessageTypes.API_CANCEL, requestId: 'r1'})
    ).toBe(true);
    expect(isWittyMessage({type: MessageTypes.API_CANCEL})).toBe(false);
    expect(
      isWittyMessage({type: MessageTypes.API_CANCEL, requestId: 'x'.repeat(65)})
    ).toBe(false);
  });
});

describe('cancelling a request', () => {
  const tab = {tab: {id: 1}, frameId: 0} as browser.Runtime.MessageSender;
  const otherTab = {tab: {id: 2}, frameId: 0} as browser.Runtime.MessageSender;
  const request: ApiRequestMessage = {
    type: MessageTypes.API_REQUEST,
    ...check,
    requestId: 'r1',
  };
  let signals: AbortSignal[];

  beforeEach(() => {
    signals = [];
    const answered = vi.mocked(fetch).getMockImplementation()!;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('oauth/token')) return answered(url, init);
        signals.push(init.signal!);
        // An API that answers only once the request is aborted.
        return new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(init.signal!.reason)
          );
        });
      })
    );
  });

  it('aborts the request the content script cancels', async () => {
    const answer = proxyApiRequest(request, tab);
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    cancelApiRequest({type: MessageTypes.API_CANCEL, requestId: 'r1'}, tab);

    expect(signals[0].aborted).toBe(true);
    expect(await answer).toEqual(expect.objectContaining({status: 0}));
  });

  it('leaves a request of another tab alone', async () => {
    void proxyApiRequest(request, tab);
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    cancelApiRequest(
      {type: MessageTypes.API_CANCEL, requestId: 'r1'},
      otherTab
    );

    expect(signals[0].aborted).toBe(false);
    cancelApiRequest({type: MessageTypes.API_CANCEL, requestId: 'r1'}, tab);
  });

  it('sends nothing for a request cancelled while the token is restored', async () => {
    // As after a browser restart: the session lost the access token.
    session.data.accessToken = '';
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let restoring = false;
    const answered = vi.mocked(fetch).getMockImplementation()!;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('oauth/token')) {
          restoring = true;
          await gate;
        }
        return answered(url, init);
      })
    );

    const answer = proxyApiRequest(request, tab);
    await vi.waitFor(() => expect(restoring).toBe(true));
    cancelApiRequest({type: MessageTypes.API_CANCEL, requestId: 'r1'}, tab);
    release();

    expect(await answer).toEqual(expect.objectContaining({status: 0}));
    expect(signals).toHaveLength(0);
  });
});

describe('backgroundApiRequest', () => {
  it('asks the background to cancel once its signal aborts', async () => {
    const sendMessage = vi.mocked(browser.runtime.sendMessage);
    sendMessage.mockReset();
    sendMessage.mockImplementation(async (message: unknown) =>
      (message as {type: string}).type === MessageTypes.API_REQUEST
        ? new Promise(() => {})
        : undefined
    );
    const controller = new AbortController();

    void backgroundApiRequest({kind: 'check', body: {}}, controller.signal);
    controller.abort();

    const [[requested], [cancel]] = sendMessage.mock.calls as [
      [{requestId: string}],
      [unknown],
    ];
    expect(cancel).toEqual({
      type: MessageTypes.API_CANCEL,
      requestId: requested.requestId,
    });
    expect(requested.requestId).toEqual(expect.any(String));
  });

  it('does not send a request cancelled while the worker was starting', async () => {
    // The first message finds no listener yet; the request is sent again
    // 100 ms later, unless it was cancelled in between.
    const sendMessage = vi.mocked(browser.runtime.sendMessage);
    sendMessage.mockReset();
    sendMessage.mockImplementationOnce(async () => {
      throw new Error(
        'Could not establish connection. Receiving end does not exist.'
      );
    });
    sendMessage.mockImplementation(async () => undefined);
    const controller = new AbortController();

    const answer = backgroundApiRequest(
      {kind: 'check', body: {}},
      controller.signal
    );
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(await answer).toEqual(expect.objectContaining({status: 0}));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const requests = sendMessage.mock.calls.filter(
      ([message]) =>
        (message as {type: string}).type === MessageTypes.API_REQUEST
    );
    expect(requests).toHaveLength(1);
  });

  it('answers at once when cancelled, without waiting for the background', async () => {
    const sendMessage = vi.mocked(browser.runtime.sendMessage);
    sendMessage.mockReset();
    // A background that never answers, as when the cancel is lost.
    sendMessage.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();

    const answer = backgroundApiRequest(
      {kind: 'check', body: {}},
      controller.signal
    );
    controller.abort();

    expect(await answer).toEqual(
      expect.objectContaining({ok: false, status: 0})
    );
  });

  it('sends nothing for a request already cancelled', async () => {
    const sendMessage = vi.mocked(browser.runtime.sendMessage);
    sendMessage.mockReset();
    const controller = new AbortController();
    controller.abort();

    expect(
      await backgroundApiRequest({kind: 'check', body: {}}, controller.signal)
    ).toEqual(expect.objectContaining({ok: false, status: 0}));
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
