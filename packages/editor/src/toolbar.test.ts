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
      if (url.endsWith('/v2.0/config-options')) {
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
    await vi.waitFor(() => expect(tool('Witty settings')).not.toBeNull());
    tool('Witty settings').click();
    await vi.waitFor(() =>
      expect(document.querySelector('select[data-field]')).not.toBeNull()
    );
  };

  it('shows the extension preferences with the API categories', async () => {
    mountEditor();
    await openSettings();

    expect(tool('Witty settings').getAttribute('aria-expanded')).toBe('true');
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

  it('closes on Escape and returns focus to the settings button', async () => {
    mountEditor();
    await openSettings();
    const panel = document.querySelector('.witty-editor-settings')!;

    panel.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
    );

    await vi.waitFor(() =>
      expect(document.querySelector('.witty-editor-settings')).toBeNull()
    );
    expect(document.activeElement).toBe(tool('Witty settings'));
  });
});
