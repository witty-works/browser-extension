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
let revocations: {url: string; authorization: string | null}[];
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
  revocations = [];
  answer = async () =>
    json(200, {
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      expires_in: 3600,
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('api/user/revoke-token')) {
        revocations.push({
          url: String(url),
          authorization: new Headers(init?.headers).get('Authorization'),
        });
        return new Response(null, {status: 204});
      }
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

  it('revokes the dropped pair on the dashboard that issued it', async () => {
    let release: (response: Response) => void = () => {};
    answer = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });

    const refreshing = getNewAccessToken('access-1');
    await settle();
    await logOut();
    // Signed out to switch to another dashboard: the pair still belongs to
    // the old one and must not be shown to the new one.
    local.data.customEndpoint = {
      ...(local.data.customEndpoint as object),
      dashboard: 'https://dashboard.other.example/',
    };
    release(
      json(200, {
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        expires_in: 3600,
      })
    );
    await refreshing;
    await vi.waitFor(() => expect(revocations).toHaveLength(1));

    expect(revocations[0]).toEqual({
      url: `${DASHBOARD}api/user/revoke-token`,
      authorization: 'Bearer access-2',
    });
  });
});

describe('a failing token endpoint', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    answer = async () => json(503, {});
    // As after a browser restart: the session lost the access token.
    session.data.accessToken = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not asked again until the backoff has passed', async () => {
    expect(await getNewAccessToken('')).toBe('failed');
    expect(await getNewAccessToken('')).toBe('failed');
    expect(tokenRequests).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(await getNewAccessToken('')).toBe('failed');
    expect(tokenRequests).toBe(2);
  });

  it('waits longer after each failure, up to a minute', async () => {
    const waits: number[] = [];
    for (let failure = 0; failure < 7; failure += 1) {
      await getNewAccessToken('');
      const before = tokenRequests;
      let waited = 0;
      while (tokenRequests === before && waited < 120000) {
        vi.advanceTimersByTime(1000);
        waited += 1000;
        await getNewAccessToken('');
      }
      waits.push(waited);
    }
    expect(waits).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000]);
  });

  it('starts again from 2 s once a minute has passed without a failure', async () => {
    for (let failure = 0; failure < 6; failure += 1) {
      await getNewAccessToken('');
      vi.advanceTimersByTime(60000);
    }
    // More than a minute after the last wait ended, a failure counts as the
    // first again.
    vi.advanceTimersByTime(61000);
    await getNewAccessToken('');
    const before = tokenRequests;
    vi.advanceTimersByTime(2000);
    await getNewAccessToken('');
    expect(tokenRequests).toBe(before + 1);
  });

  it('ignores a backoff further ahead than the longest wait', async () => {
    // As after the system clock was set back by an hour.
    session.data.refreshBackoff = {failures: 3, until: Date.now() + 3600000};
    await getNewAccessToken('');
    expect(tokenRequests).toBe(1);
  });

  it('keeps the backoff in storage.session, which outlives the worker', async () => {
    await getNewAccessToken('');
    expect(session.data.refreshBackoff).toEqual(
      expect.objectContaining({failures: 1})
    );
    expect(local.data.refreshBackoff).toBeUndefined();
  });

  it('forgets the backoff once a refresh succeeds', async () => {
    await getNewAccessToken('');
    vi.advanceTimersByTime(2000);
    answer = async () =>
      json(200, {
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        expires_in: 3600,
      });
    expect(await getNewAccessToken('')).toBe('refreshed');
    expect(session.data.refreshBackoff).toBeNull();
  });

  it('forgets the backoff on sign-out', async () => {
    await getNewAccessToken('');
    await logOut();
    expect(session.data.refreshBackoff).toBeNull();
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
