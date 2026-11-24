// @vitest-environment happy-dom
// The extension's background API proxy (source/Background/apiProxy.ts) and
// the message check in front of it (source/shared/messages.ts), against an
// in-memory storage and a mocked network. With the editor's unit tests
// because they are the repository's only unit test suite.
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {proxyApiRequest} from '../../../source/Background/apiProxy';
import {isWittyMessage, MessageTypes} from '@witty/core/messages';
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
  });
});
