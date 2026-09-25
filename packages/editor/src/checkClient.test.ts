import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  apiEndpoint,
  type CheckConfig,
  CheckHttpError,
  CheckTimeoutError,
  createHttpChecker,
  genderSeparatorFor,
} from './checkClient';

/** Stub fetch and return the parsed body of each request it receives. */
const captureBodies = (response = {results: []}, status = 200) => {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(response), {status});
    })
  );
  return bodies;
};

const check = async (options: {config?: CheckConfig; lang?: 'de'}) => {
  const bodies = captureBodies();
  await createHttpChecker({
    endpoint: 'https://api.example/',
    config: () => options.config,
    lang: options.lang,
  })('Hallo', new AbortController().signal);
  return bodies[0];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpChecker', () => {
  it('sends no config key when nothing is configured', async () => {
    expect(await check({})).not.toHaveProperty('config');
    expect(await check({config: {}})).not.toHaveProperty('config');
  });

  it('sends exactly the fields that are set', async () => {
    const config: CheckConfig = {
      german_gender_ending: 'de-e',
      disabled_categories: ['slurs'],
      llm_alternatives: false,
    };
    expect((await check({config})).config).toEqual(config);
  });

  it('strips undefined fields', async () => {
    const body = await check({
      config: {german_gender_ending: ':in', french_gender_separator: undefined},
    });
    expect(body.config).toEqual({german_gender_ending: ':in'});
    expect(
      await check({config: {french_gender_separator: undefined}})
    ).not.toHaveProperty('config');
  });

  it('sends the language, auto by default', async () => {
    expect((await check({lang: 'de'})).lang).toBe('de');
    expect((await check({})).lang).toBe('auto');
  });

  it('identifies itself as witty-editor with its version', async () => {
    const {version} = (await import('../package.json')).default;
    const body = await check({});

    // The API splits `client` on ":"; without a name it would assume the
    // browser extension and apply that client's minimum version.
    expect(body.client).toBe(`witty-editor:${version}`);
    expect(body.id).toBe('witty-editor');
  });

  it('reads the config per request', async () => {
    const bodies = captureBodies();
    let config: CheckConfig = {german_gender_ending: '*in'};
    const checker = createHttpChecker({
      endpoint: 'https://api.example/',
      config: () => config,
    });

    await checker('a', new AbortController().signal);
    config = {french_gender_separator: '·'};
    await checker('b', new AbortController().signal);

    expect(bodies.map((body) => body.config)).toEqual([
      {german_gender_ending: '*in'},
      {french_gender_separator: '·'},
    ]);
  });

  it('carries the API detail of a refused config', async () => {
    captureBodies(
      {
        detail: [
          {
            loc: ['body', 'config', 'german_gender_ending'],
            msg: "Input should be '/in', ...",
          },
        ],
      } as never,
      422
    );
    const error = await createHttpChecker({endpoint: 'https://api.example/'})(
      'Hallo',
      new AbortController().signal
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CheckHttpError);
    expect((error as CheckHttpError).status).toBe(422);
    expect((error as Error).message).toBe(
      "check failed: HTTP 422: config.german_gender_ending: Input should be '/in', ..."
    );
  });
});

describe('createHttpChecker timeouts', () => {
  /** A fetch that never answers, until its signal aborts it. */
  const hang = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      )
    );

  it('fails a request that takes longer than its timeout', async () => {
    hang();
    const checker = createHttpChecker({
      endpoint: 'https://api.example/',
      timeoutMs: 20,
    });

    const error = await checker('Hallo', new AbortController().signal).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(CheckTimeoutError);
    expect((error as Error).message).toBe(
      'check failed: no answer within 0.02s'
    );
  });

  it('is aborted by its caller without counting as a timeout', async () => {
    hang();
    const controller = new AbortController();
    const pending = createHttpChecker({
      endpoint: 'https://api.example/',
      timeoutMs: 10_000,
    })('Hallo', controller.signal).catch((caught: unknown) => caught);

    controller.abort();

    const error = await pending;
    expect(error).not.toBeInstanceOf(CheckTimeoutError);
    expect((error as Error).name).toBe('AbortError');
  });
});

describe('genderSeparatorFor', () => {
  const config: CheckConfig = {
    german_gender_ending: ':in',
    french_gender_separator: '·s',
  };

  it('follows the config field for the text language', () => {
    expect(genderSeparatorFor('de', config)).toBe(':in');
    expect(genderSeparatorFor('de-CH', config)).toBe(':in');
    expect(genderSeparatorFor('fr', config)).toBe('·s');
    expect(genderSeparatorFor('en', config)).toBeUndefined();
  });

  it('leaves it to the account when the caller set nothing', () => {
    expect(genderSeparatorFor('de', {})).toBeUndefined();
    expect(genderSeparatorFor('de', undefined)).toBeUndefined();
  });
});

describe('apiEndpoint', () => {
  const page = 'https://host.example/app/page.html?x=1';

  it.each([
    [undefined, 'https://host.example/'],
    ['https://api.example', 'https://api.example/'],
    ['https://api.example/nlp/', 'https://api.example/nlp/'],
    ['http://localhost:8000/', 'http://localhost:8000/'],
    ['/nlp', 'https://host.example/nlp/'],
    ['https://api.example/?key=x#y', 'https://api.example/'],
  ])('takes %s as %s', (value, expected) => {
    expect(apiEndpoint(value, page)).toBe(expected);
  });

  it.each([['javascript:alert(1)'], ['ftp://api.example/'], ['http://[::1']])(
    'refuses %s',
    (value) => {
      expect(() => apiEndpoint(value, page)).toThrow(TypeError);
    }
  );
});
