// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TextSelection} from '@tiptap/pm/state';

import {
  CATEGORIES,
  checkResponse,
  CONFIG_OPTIONS,
} from '@witty/test-fixtures/mockApi';
import {type EditorSettings, mount, type WittyEditorHandle} from './mount';

let handle: WittyEditorHandle | undefined;
let checkBodies: Record<string, unknown>[];
let settingsChanges: EditorSettings[];

beforeEach(() => {
  checkBodies = [];
  settingsChanges = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/v2.0/categories')) {
        return new Response(JSON.stringify(CATEGORIES));
      }
      if (url.includes('/v2.0/config-options')) {
        return new Response(JSON.stringify(CONFIG_OPTIONS));
      }
      const body = JSON.parse(String(init?.body));
      checkBodies.push(body);
      return new Response(JSON.stringify(checkResponse(body.text)));
    })
  );
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const mountEditor = () => {
  const element = document.createElement('div');
  document.body.append(element);
  handle = mount(element, {
    endpoint: 'https://api.example/',
    content: '<p>Hello world</p>',
    delay: 0,
    onSettingsChange: (settings) => settingsChanges.push(settings),
  });
  return handle;
};

const tool = (label: string) =>
  document.querySelector<HTMLButtonElement>(
    `.witty-editor-toolbar button[aria-label="${label}"]`
  )!;

const menuItem = (label: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '[role="menu"] [role="menuitem"]'
    ),
  ].find((item) => item.textContent?.startsWith(label))!;

/** Opens the W menu and chooses an entry. */
const chooseFromMenu = async (label: string) => {
  await vi.waitFor(() => expect(tool('Witty menu')).not.toBeNull());
  tool('Witty menu').click();
  await vi.waitFor(() => expect(menuItem(label)).toBeDefined());
  menuItem(label).click();
};

describe('toolbar', () => {
  it('toggles bold on the selection and shows it as pressed', async () => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(tool('Bold')).not.toBeNull());
    const {view} = editor.editor;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6))
    );

    tool('Bold').click();

    expect(editor.editor.getHTML()).toContain('<strong>Hello</strong>');
    await vi.waitFor(() =>
      expect(tool('Bold').getAttribute('aria-pressed')).toBe('true')
    );
  });

  it('is one tab stop, moved with the arrow keys', async () => {
    mountEditor();
    await vi.waitFor(() => expect(tool('Bold')).not.toBeNull());
    const tabbable = () =>
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.witty-editor-toolbar button'
        ),
      ].filter((button) => button.tabIndex === 0);

    expect(
      tabbable().map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Bold']);

    tool('Bold').focus();
    tool('Bold').dispatchEvent(
      new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true})
    );

    await vi.waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Italic')
    );
    expect(
      tabbable().map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Italic']);
  });
});

describe('settings panel', () => {
  const openSettings = async () => {
    await chooseFromMenu('Settings');
    await vi.waitFor(() =>
      expect(document.querySelector('select[data-field]')).not.toBeNull()
    );
  };

  it('shows the extension preferences with the API categories', async () => {
    mountEditor();
    await openSettings();

    expect(
      document.querySelector('.witty-editor-settings')?.getAttribute('role')
    ).toBe('region');
    expect(document.querySelectorAll('.witty-category-toggle').length).toBe(
      CATEGORIES.categories.length
    );
  });

  it('checks again with a chosen gender format and tells the host', async () => {
    mountEditor();
    await vi.waitFor(() => expect(checkBodies.length).toBeGreaterThan(0));
    await openSettings();
    const before = checkBodies.length;

    const select = document.querySelector<HTMLSelectElement>(
      'select[data-field="german_gender_ending"]'
    )!;
    select.value = ':in';
    select.dispatchEvent(new Event('change', {bubbles: true}));

    await vi.waitFor(() => expect(checkBodies.length).toBe(before + 1));
    expect(checkBodies.at(-1)?.config).toEqual({german_gender_ending: ':in'});
    expect(settingsChanges.at(-1)?.config).toEqual({
      german_gender_ending: ':in',
    });
  });

  it('reflects setConfig from the host', async () => {
    const editor = mountEditor();
    await openSettings();

    editor.setConfig({german_gender_ending: 'de-e'});

    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLSelectElement>(
          'select[data-field="german_gender_ending"]'
        )?.value
      ).toBe('de-e')
    );
  });

  it('switches the browser spellcheck with the spelling setting', async () => {
    const editor = mountEditor();
    await openSettings();
    const spellcheck = () => editor.editor.view.dom.getAttribute('spellcheck');
    expect(spellcheck()).toBe('false');

    document
      .querySelector<HTMLInputElement>('input[id$="opt-orthography"]')!
      .click();

    await vi.waitFor(() => expect(spellcheck()).toBe('true'));
  });

  it('closes on Escape and returns focus to the W icon', async () => {
    mountEditor();
    await openSettings();
    const panel = document.querySelector('.witty-editor-settings')!;

    panel.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
    );

    await vi.waitFor(() =>
      expect(document.querySelector('.witty-editor-settings')).toBeNull()
    );
    expect(document.activeElement).toBe(tool('Witty menu'));
  });
});

describe('Witty status button', () => {
  const statusButton = () => tool('Witty menu');
  const liveRegion = () =>
    document.querySelector('.witty-editor-toolbar ~ [role="status"]');

  it('announces the number of suggestions once the check is done', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    handle = mount(element, {
      endpoint: 'https://api.example/',
      // Two of the mock's alerts: "guys" and "chairman".
      content: '<p>Hey guys, the chairman will assume the leadership role.</p>',
      delay: 0,
    });

    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe('2 suggestions')
    );
    expect(statusButton().classList).toContain('is-idle');
    expect(statusButton().getAttribute('title')).toBe(
      'Witty menu · 2 suggestions'
    );
  });

  it('shows the check in progress, and stays silent meanwhile', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          })
      )
    );
    mountEditor();

    await vi.waitFor(() =>
      expect(statusButton()?.classList).toContain('is-checking')
    );
    expect(liveRegion()?.textContent).toBe('');

    answer(new Response(JSON.stringify(checkResponse('Hello world'))));
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe('No suggestions')
    );
  });

  it('describes the editable with the keyboard shortcut', async () => {
    const editor = mountEditor();
    const id = editor.editor.view.dom.getAttribute('aria-describedby');

    expect(document.getElementById(id!)?.textContent).toBe(
      'Press Alt+Shift+W to open the suggestion at the cursor.'
    );
  });
});

describe('host API', () => {
  const mountWith = (options: Parameters<typeof mount>[1]) => {
    const element = document.createElement('div');
    document.body.append(element);
    handle = mount(element, {
      endpoint: 'https://api.example/',
      delay: 0,
      ...options,
    });
    return handle;
  };

  it('reports and shows a text that was only partly checked', async () => {
    const statuses: unknown[] = [];
    mountWith({
      content:
        '<p>Hey guys, the chairman will assume the leadership role. This is a spelling mistacke.</p>',
      maxTextLength: 60,
      onStatus: (status) => statuses.push(status),
    });

    await vi.waitFor(() =>
      expect(statuses.at(-1)).toEqual({
        state: 'idle',
        alerts: 2,
        limitReached: true,
      })
    );
    const hint = document.querySelector<HTMLElement>('.witty-editor-limit')!;
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe('Only part of this text was checked.');
    expect(
      document.querySelector('.witty-editor-toolbar ~ [role="status"]')
        ?.textContent
    ).toBe('2 suggestions. Only part of this text was checked.');
  });

  it('reports limitReached false and hides the hint for a fully checked text', async () => {
    const statuses: unknown[] = [];
    mountWith({
      content: '<p>Hello world</p>',
      onStatus: (s) => statuses.push(s),
    });

    await vi.waitFor(() =>
      expect(statuses.at(-1)).toEqual({
        state: 'idle',
        alerts: 0,
        limitReached: false,
      })
    );
    expect(
      document.querySelector<HTMLElement>('.witty-editor-limit')!.hidden
    ).toBe(true);
  });

  it('returns the current settings as a copy', () => {
    const editor = mountWith({
      config: {german_gender_ending: ':in'},
      llmAlternatives: true,
    });

    const settings = editor.getSettings();
    expect(settings).toEqual({
      config: {german_gender_ending: ':in'},
      llmAlternatives: true,
      orthography: true,
    });

    settings.config.german_gender_ending = 'de-e';
    expect(editor.getSettings().config).toEqual({
      german_gender_ending: ':in',
    });

    editor.setConfig({french_gender_separator: '·'});
    expect(editor.getSettings().config).toEqual({
      french_gender_separator: '·',
    });
  });

  it('keeps the host description when the attributes are applied again', async () => {
    const editor = mountWith({describedBy: 'help-a help-b'});
    const describedBy = () =>
      editor.editor.view.dom.getAttribute('aria-describedby')!.split(' ');
    expect(describedBy()).toEqual([
      expect.stringMatching(/^witty-editor-hint-/),
      'help-a',
      'help-b',
    ]);

    // The spelling setting re-applies the editable's attributes.
    await chooseFromMenu('Settings');
    await vi.waitFor(() =>
      expect(
        document.querySelector('input[id$="opt-orthography"]')
      ).not.toBeNull()
    );
    document
      .querySelector<HTMLInputElement>('input[id$="opt-orthography"]')!
      .click();
    await vi.waitFor(() =>
      expect(editor.editor.view.dom.getAttribute('spellcheck')).toBe('true')
    );

    expect(describedBy().slice(1)).toEqual(['help-a', 'help-b']);
  });
});

describe('toolbar formatting', () => {
  const select = (editor: WittyEditorHandle, from: number, to: number) => {
    const {view} = editor.editor;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to))
    );
  };

  it.each([
    ['Italic', '<em>Hello</em>'],
    ['Underline', '<u>Hello</u>'],
  ])('%s marks the selection', async (label, html) => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(tool(label)).not.toBeNull());
    select(editor, 1, 6);
    tool(label).click();
    expect(editor.editor.getHTML()).toContain(html);
  });

  it.each([
    ['Heading', '<h2>'],
    ['Bulleted list', '<ul>'],
    ['Numbered list', '<ol>'],
    ['Quote', '<blockquote>'],
  ])('%s turns the paragraph into a block', async (label, html) => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(tool(label)).not.toBeNull());
    select(editor, 2, 2);
    tool(label).click();
    expect(editor.editor.getHTML()).toContain(html);
  });

  it('undoes and redoes', async () => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(tool('Bold')).not.toBeNull());
    select(editor, 1, 6);
    tool('Bold').click();

    // Enabled states follow the editor after a re-render.
    await vi.waitFor(() =>
      expect(tool('Undo').getAttribute('aria-disabled')).toBe('false')
    );
    tool('Undo').click();
    expect(editor.editor.getHTML()).not.toContain('<strong>');
    await vi.waitFor(() =>
      expect(tool('Redo').getAttribute('aria-disabled')).toBe('false')
    );
    tool('Redo').click();
    expect(editor.editor.getHTML()).toContain('<strong>Hello</strong>');
  });
});

describe('settings panel changes', () => {
  const openSettings = async () => {
    await chooseFromMenu('Settings');
    await vi.waitFor(() =>
      expect(document.querySelector('.witty-category-toggle')).not.toBeNull()
    );
  };

  it('switches a category off and checks again without it', async () => {
    mountEditor();
    await vi.waitFor(() => expect(checkBodies.length).toBeGreaterThan(0));
    await openSettings();
    const before = checkBodies.length;

    const toggle = document.querySelector<HTMLButtonElement>(
      '[data-category="gendered_nouns"]'
    )!;
    toggle.click(); // advanced -> off

    await vi.waitFor(() => expect(checkBodies.length).toBe(before + 1));
    expect(checkBodies.at(-1)?.config).toEqual({
      disabled_categories: ['gendered_nouns', 'gendered_nouns_advanced'],
    });
  });

  it('switches AI suggestions and tells the host', async () => {
    mountEditor();
    await openSettings();

    document
      .querySelector<HTMLInputElement>('input[id$="opt-llm-alternatives"]')!
      .click();

    expect(settingsChanges.at(-1)?.llmAlternatives).toBe(true);
    expect(handle?.getSettings().llmAlternatives).toBe(true);
  });

  it('asks for labels in its language, and without on older APIs', async () => {
    const optionUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/v2.0/categories')) {
          return new Response(JSON.stringify(CATEGORIES));
        }
        if (url.includes('/v2.0/config-options')) {
          optionUrls.push(url);
          // APIs up to 2.4.8 refuse the parameter.
          return url.includes('?locale=')
            ? new Response('{}', {status: 422})
            : new Response(JSON.stringify(CONFIG_OPTIONS));
        }
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify(checkResponse(body.text)));
      })
    );
    mountEditor();
    await openSettings();

    const locale = navigator.language.split('-')[0];
    expect(optionUrls).toEqual([
      `https://api.example/v2.0/config-options?locale=${locale}`,
      'https://api.example/v2.0/config-options',
    ]);
    await vi.waitFor(() =>
      expect(
        document.querySelector(
          'select[data-field="german_gender_ending"] option[value=":in"]'
        )?.textContent
      ).toBe('Colon, f.e Expert:in')
    );
  });

  it('says when the categories cannot be loaded, and tries again next time', async () => {
    let categoryRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/v2.0/categories')) {
          categoryRequests += 1;
          return new Response('{}', {status: 503});
        }
        if (url.endsWith('/v2.0/config-options')) {
          return new Response(JSON.stringify(CONFIG_OPTIONS));
        }
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify(checkResponse(body.text)));
      })
    );
    mountEditor();
    await chooseFromMenu('Settings');
    await vi.waitFor(() =>
      expect(
        document.querySelector('.witty-editor-settings')?.textContent
      ).toContain('Could not load categories.')
    );

    document
      .querySelector<HTMLButtonElement>('.witty-editor-settings-close')!
      .click();
    await vi.waitFor(() =>
      expect(document.querySelector('.witty-editor-settings')).toBeNull()
    );
    await chooseFromMenu('Settings');
    await vi.waitFor(() => expect(categoryRequests).toBe(2));
  });
});

describe('check failures', () => {
  const failWith = (status: number) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"detail":"nope"}', {status}))
    );

  it('reports a rejected key and shows the warning W', async () => {
    failWith(401);
    const statuses: unknown[] = [];
    const element = document.createElement('div');
    document.body.append(element);
    handle = mount(element, {
      endpoint: 'https://api.example/',
      content: '<p>Hey guys</p>',
      delay: 0,
      onStatus: (status) => statuses.push(status),
    });

    await vi.waitFor(() =>
      expect(statuses.at(-1)).toEqual({state: 'unauthorized'})
    );
    await vi.waitFor(() =>
      expect(tool('Witty menu').classList).toContain('is-unauthorized')
    );
    expect(
      document.querySelector('.witty-editor-toolbar ~ [role="status"]')
        ?.textContent
    ).toBe('API key missing or not accepted');
  });

  it('reports other failures with the API detail', async () => {
    failWith(500);
    const statuses: {state: string; message?: string}[] = [];
    const element = document.createElement('div');
    document.body.append(element);
    handle = mount(element, {
      endpoint: 'https://api.example/',
      content: '<p>Hey guys</p>',
      delay: 0,
      onStatus: (status) => statuses.push(status as never),
    });

    await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('error'));
    expect(statuses.at(-1)?.message).toBe('check failed: HTTP 500: nope');
  });
});

describe('setApiKey', () => {
  it('sends the key and checks every sentence again', async () => {
    const headers: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        headers.push(new Headers(init?.headers).get('x-key'));
        const body = JSON.parse(String(init?.body));
        checkBodies.push(body);
        return new Response(JSON.stringify(checkResponse(body.text)));
      })
    );
    const editor = mountEditor();
    await vi.waitFor(() => expect(checkBodies).toHaveLength(1));

    editor.setApiKey('secret');

    await vi.waitFor(() => expect(checkBodies).toHaveLength(2));
    // The whole text again, not only what the cache was missing.
    expect(checkBodies[1].text).toBe(checkBodies[0].text);
    expect(headers).toEqual([null, 'secret']);
  });
});
