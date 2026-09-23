// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TextSelection} from '@tiptap/pm/state';

// The e2e suite's canned API: the same sample text and alerts.
import {checkResponse, SAMPLE_TEXT} from '@witty/test-fixtures/mockApi';
import {type EditorStatus, mount, type WittyEditorHandle} from './mount';

let handle: WittyEditorHandle | undefined;
let statuses: EditorStatus[];
let rephraseCalls: number;
/** How the next rephrase request is answered. */
let rephrase: () => Promise<Response>;

beforeEach(() => {
  statuses = [];
  rephraseCalls = 0;
  rephrase = async () =>
    new Response(JSON.stringify({sentence: '', results: {}}), {status: 200});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/v1.0/rephrase')) {
        rephraseCalls += 1;
        return rephrase();
      }
      const {text} = JSON.parse(String(init.body));
      return new Response(JSON.stringify(checkResponse(text)), {status: 200});
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
    content: `<p>${SAMPLE_TEXT}</p>`,
    delay: 0,
    llmAlternatives: true,
    onStatus: (status) => statuses.push(status),
  });
  return handle;
};

const lastAlertCount = () => {
  const last = statuses.at(-1);
  return last?.state === 'idle' ? last.alerts : undefined;
};

/** Put the caret in `word` and press the extension's shortcut. */
const openPopoverOn = (editor: WittyEditorHandle, word: string) => {
  const {view} = editor.editor;
  const pos = 1 + SAMPLE_TEXT.indexOf(word) + 1;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, pos))
  );
  view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'W',
      code: 'KeyW',
      keyCode: 87,
      altKey: true,
      shiftKey: true,
      bubbles: true,
    })
  );
};

const popover = () => document.getElementById('witty-works-ext-popover');

/** Escape, as a user closes it; React unmounts it asynchronously. */
const closePopover = async () => {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
  );
  await vi.waitFor(() => expect(popover()).toBeNull());
};

describe('popover in the editor', () => {
  it('reports the lower alert count after "ignore once"', async () => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(lastAlertCount()).toBeGreaterThan(1));
    const before = lastAlertCount()!;

    openPopoverOn(editor, 'guys');
    await vi.waitFor(() => expect(popover()).not.toBeNull());
    const ignore = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Ignore once')
    );
    ignore!.click();

    await vi.waitFor(() => expect(lastAlertCount()).toBe(before - 1));
  });

  it('asks for rewrites again after the config changed', async () => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(lastAlertCount()).toBeGreaterThan(0));

    openPopoverOn(editor, 'guys');
    await vi.waitFor(() => expect(rephraseCalls).toBe(1));
    await closePopover();

    editor.setConfig({german_gender_ending: ':in'});
    await vi.waitFor(() => expect(lastAlertCount()).toBeGreaterThan(0));
    openPopoverOn(editor, 'guys');

    await vi.waitFor(() => expect(rephraseCalls).toBe(2));
  });

  it('retries rewrites that failed', async () => {
    rephrase = async () => new Response('{}', {status: 401});
    const editor = mountEditor();
    await vi.waitFor(() => expect(lastAlertCount()).toBeGreaterThan(0));

    openPopoverOn(editor, 'guys');
    await vi.waitFor(() => expect(rephraseCalls).toBe(1));
    await closePopover();
    openPopoverOn(editor, 'guys');

    await vi.waitFor(() => expect(rephraseCalls).toBe(2));
  });

  it('ignores a rewrite that arrives after destroy', async () => {
    let answer: (response: Response) => void = () => undefined;
    rephrase = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    const editor = mountEditor();
    await vi.waitFor(() => expect(lastAlertCount()).toBeGreaterThan(0));
    openPopoverOn(editor, 'guys');
    await vi.waitFor(() => expect(rephraseCalls).toBe(1));

    editor.destroy();
    handle = undefined;
    answer(
      new Response(JSON.stringify({sentence: '', results: {}}), {status: 200})
    );

    // An update to the unmounted root would surface as an unhandled error.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popover()).toBeNull();
  });
});
