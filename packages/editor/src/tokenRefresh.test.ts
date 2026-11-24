// @vitest-environment happy-dom
// The extension's token refresh (source/shared/utils.ts), run against an
// in-memory storage and a mocked token endpoint. It lives with the editor's
// unit tests because they are the repository's only unit test suite.
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getNewAccessToken, logOut, refreshSettled} from '@witty/core/utils';
import {registerStorage, type StorageArea} from '@witty/core/platform/storage';

vi.mock('webextension-polyfill', () => {
  return {
    default: {
      action: {setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn()},
      runtime: {sendMessage: vi.fn()},
    },
  };
});

const DASHBOARD = 'https://dashboard.custom.example/';

const memoryArea = (): StorageArea & {data: Record<string, unknown>} => {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (keys) => {
      if (keys === null || keys === undefined) return {...data};
      const list = typeof keys === 'string' ? [keys] : Object.keys(keys);
      const names = Array.isArray(keys) ? keys : list;
      return Object.fromEntries(
        names.filter((key) => key in data).map((key) => [key, data[key]])
      );
    },
    set: async (items) => {
      Object.assign(data, items);
    },
  };
};

let local: ReturnType<typeof memoryArea>;
let session: ReturnType<typeof memoryArea>;
let tokenRequests: number;
let lastSignal: AbortSignal | undefined;
/** How the token endpoint answers the next refresh. */
let answer: () => Promise<Response>;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });

/** Let the fire-and-forget storage writes of logOut() land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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
      api: 'https://api.custom.example/',
      dashboard: DASHBOARD,
      oauth_client_id: 'client',
      posthog_url: '',
      posthog_key: '',
    },
    refreshToken: 'refresh-1',
    accessTokenExpiresAt: 0,
    signedIn: true,
  });
  session.data.accessToken = 'access-1';

  tokenRequests = 0;
  answer = async () =>
    json(200, {
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      expires_in: 3600,
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe(`${DASHBOARD}oauth/token`);
      lastSignal = init?.signal ?? undefined;
      tokenRequests += 1;
      return answer();
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getNewAccessToken', () => {
  it('refreshes once for concurrent callers with the same failed token', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const first = answer;
    answer = async () => {
      await gate;
      return first();
    };

    const outcomes = Promise.all([
      getNewAccessToken('access-1'),
      getNewAccessToken('access-1'),
      getNewAccessToken('access-1'),
    ]);
    await settle();
    release();

    expect(await outcomes).toEqual(['refreshed', 'refreshed', 'refreshed']);
    expect(tokenRequests).toBe(1);
    expect(session.data.accessToken).toBe('access-2');
    expect(local.data.refreshToken).toBe('refresh-2');
  });

  it('does not refresh when the stored token already differs from the failed one', async () => {
    session.data.accessToken = 'access-2';
    expect(await getNewAccessToken('access-1')).toBe('refreshed');
    expect(tokenRequests).toBe(0);
  });

  it.each([
    ['invalid_grant', 400],
    ['invalid_request', 401],
  ])(
    'signs out when the dashboard rejects the refresh token (%s, %i)',
    async (error, status) => {
      answer = async () => json(status, {error});
      expect(await getNewAccessToken('access-1')).toBe('signedOut');
      await settle();
      expect(session.data.accessToken).toBe('');
      expect(local.data.refreshToken).toBe('');
      expect(local.data.signedIn).toBe(false);
    }
  );

  it.each([
    ['a server error', async () => json(503, {})],
    ['a rate limit', async () => json(429, {})],
    [
      'a network error',
      async (): Promise<Response> => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('keeps the tokens after %s', async (_label, failure) => {
    answer = failure;
    expect(await getNewAccessToken('access-1')).toBe('failed');
    await settle();
    expect(session.data.accessToken).toBe('access-1');
    expect(local.data.refreshToken).toBe('refresh-1');
    expect(local.data.signedIn).toBe(true);
  });

  it('sends nothing while the stored endpoint is unknown', async () => {
    local.data.apiEndpoint = 'GoneEndpoint';
    expect(await getNewAccessToken('access-1')).toBe('failed');
    expect(tokenRequests).toBe(0);
    expect(local.data.refreshToken).toBe('refresh-1');
  });

  it('signs out when there is no refresh token', async () => {
    local.data.refreshToken = '';
    expect(await getNewAccessToken('access-1')).toBe('signedOut');
    expect(tokenRequests).toBe(0);
  });
});

describe('signing out during a refresh', () => {
  it('does not let a refresh that finishes afterwards sign the user back in', async () => {
    let release: (response: Response) => void = () => {};
    answer = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });

    const refreshing = getNewAccessToken('access-1');
    await settle();
    await logOut();
    release(
      json(200, {
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        expires_in: 3600,
      })
    );
    await refreshing;
    await settle();

    expect(local.data.signedIn).toBe(false);
    expect(local.data.refreshToken).toBe('');
    expect(session.data.accessToken).toBe('');
  });
});

describe('a token endpoint that does not answer', () => {
  it('gives the token request a timeout', async () => {
    await getNewAccessToken('access-1');
    expect(lastSignal).toBeInstanceOf(AbortSignal);
  });

  it('does not keep sign-out waiting for the refresh', async () => {
    answer = () => new Promise<Response>(() => {});
    void getNewAccessToken('access-1');
    await settle();

    vi.useFakeTimers();
    try {
      let settled = false;
      const waiting = refreshSettled().then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(3000);
      await waiting;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
