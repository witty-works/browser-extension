// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {checkResponse, SAMPLE_TEXT} from '@witty/test-fixtures/mockApi';
import {mount, type WittyEditorHandle} from './mount';

// Signing in with an access token: an embedding page such as the dashboard
// hands the editor a short-lived bearer token instead of an API key.

let handle: WittyEditorHandle | undefined;
let checkHeaders: Record<string, string>[];

beforeEach(() => {
  checkHeaders = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/v2.4/check')) {
        checkHeaders.push({...(init.headers as Record<string, string>)});
      }
      const {text} = JSON.parse(String(init.body ?? '{}'));
      return new Response(JSON.stringify(checkResponse(text ?? '')), {
        status: 200,
      });
    })
  );
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const mountEditor = (options: Parameters<typeof mount>[1] = {}) => {
  const element = document.createElement('div');
  document.body.append(element);
  handle = mount(element, {
    endpoint: 'https://api.example/',
    content: `<p>${SAMPLE_TEXT}</p>`,
    delay: 0,
    ...options,
  });
  return handle;
};

describe('access token', () => {
  it('sends the token as a bearer header', async () => {
    mountEditor({accessToken: 't1'});
    await vi.waitFor(() => expect(checkHeaders.length).toBeGreaterThan(0));
    expect(checkHeaders[0]['Authorization']).toBe('Bearer t1');
    expect(checkHeaders[0]['x-key']).toBeUndefined();
  });

  it('setAccessToken replaces the token and checks again', async () => {
    const editor = mountEditor({accessToken: 't1'});
    await vi.waitFor(() => expect(checkHeaders.length).toBeGreaterThan(0));
    const before = checkHeaders.length;
    editor.setAccessToken('t2');
    await vi.waitFor(() => expect(checkHeaders.length).toBeGreaterThan(before));
    expect(checkHeaders.at(-1)!['Authorization']).toBe('Bearer t2');
  });

  it('an API key wins over a token', async () => {
    mountEditor({apiKey: 'k', accessToken: 't'});
    await vi.waitFor(() => expect(checkHeaders.length).toBeGreaterThan(0));
    expect(checkHeaders[0]['x-key']).toBe('k');
    expect(checkHeaders[0]['Authorization']).toBeUndefined();
  });
});
