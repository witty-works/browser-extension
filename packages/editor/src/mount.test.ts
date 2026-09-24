// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {mount, type WittyEditorHandle} from './mount';
import type {MountOptions} from './api';

/** Check request bodies the mounted editor sends, in order. */
let bodies: Record<string, unknown>[];
let handle: WittyEditorHandle | undefined;

beforeEach(() => {
  bodies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({results: []}), {status: 200});
    })
  );
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  vi.unstubAllGlobals();
});

const mountEditor = (options: MountOptions) => {
  const element = document.createElement('div');
  document.body.append(element);
  handle = mount(element, {
    endpoint: 'https://api.example/',
    content: '<p>Hallo liebe Lehrer</p>',
    delay: 0,
    ...options,
  });
  return handle;
};

/** Wait for the `count`th check request. */
const checked = (count: number) =>
  vi.waitFor(() => {
    expect(bodies).toHaveLength(count);
  });

describe('mount', () => {
  it('sends the lang and config it was mounted with', async () => {
    mountEditor({lang: 'de', config: {german_gender_ending: 'de-e'}});
    await checked(1);

    expect(bodies[0].lang).toBe('de');
    expect(bodies[0].config).toEqual({german_gender_ending: 'de-e'});
  });

  it('sends no config when mounted without one', async () => {
    mountEditor({});
    await checked(1);

    expect(bodies[0]).not.toHaveProperty('config');
  });

  it('setConfig replaces the config and checks again', async () => {
    const editor = mountEditor({
      config: {german_gender_ending: '*in', french_gender_separator: '·'},
    });
    await checked(1);

    editor.setConfig({gendered_roles_format: 'both'});
    await checked(2);
    expect(bodies[1].config).toEqual({gendered_roles_format: 'both'});

    editor.setConfig({});
    await checked(3);
    expect(bodies[2]).not.toHaveProperty('config');
  });
});
