import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState, type Transaction} from '@tiptap/pm/state';

import type {ICheckResponse, ICheckResponseResult} from './checkClient';
import {
  alertTone,
  CheckController,
  type CheckView,
  checkPluginKey,
  createCheckPlugin,
  getAlerts,
  requestRecheck,
} from './checkPlugin';

const schema = getSchema([StarterKit]);

/** Flags every occurrence of these words, at their offsets in the text. */
const FLAGGED = ['guys', 'chairman'];

const respond = (text: string): ICheckResponse => {
  const results: ICheckResponseResult[] = [];
  for (const word of FLAGGED) {
    for (
      let at = text.indexOf(word);
      at !== -1;
      at = text.indexOf(word, at + 1)
    ) {
      results.push({
        text: word,
        start: at,
        end: at + word.length,
        category: 'gendered',
        gravity: 2,
      } as ICheckResponseResult);
    }
  }
  return {results} as ICheckResponse;
};

/** A checker whose responses the test releases explicitly. */
const deferredChecker = () => {
  const calls: {
    text: string;
    signal: AbortSignal;
    resolve: (response: ICheckResponse) => void;
  }[] = [];

  const check = (text: string, signal: AbortSignal) =>
    new Promise<ICheckResponse>((resolve) => {
      calls.push({text, signal, resolve});
    });

  return {check, calls};
};

/** Minimal view: applies transactions and notifies the controller. */
const createHarness = (paragraphs: string[], check = deferredChecker()) => {
  const plugin = createCheckPlugin({check: check.check, delay: 100});
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: paragraphs.map((text) => {
      return {
        type: 'paragraph',
        content: text ? [{type: 'text', text}] : [],
      };
    }),
  });

  // Filled in below; dispatch only runs once the controller exists.
  const ref: {controller?: CheckController} = {};
  const view: CheckView & {composing: boolean; state: EditorState} = {
    composing: false,
    state: EditorState.create({doc, plugins: [plugin]}),
    dispatch(tr: Transaction) {
      const prevState = this.state;
      this.state = this.state.apply(tr);
      ref.controller?.update(this, prevState);
    },
  };
  const controller = new CheckController(view, {
    check: check.check,
    delay: 100,
  });
  ref.controller = controller;

  const edit = (build: (tr: Transaction) => Transaction) =>
    view.dispatch(build(view.state.tr));

  /** Document position of the first `needle`. */
  const posOf = (needle: string) => {
    let found = -1;
    view.state.doc.descendants((node, pos) => {
      if (found === -1 && node.isText) {
        const index = node.text!.indexOf(needle);
        if (index !== -1) found = pos + index;
      }
    });
    if (found === -1) throw new Error(`no "${needle}"`);
    return found;
  };

  const shown = () =>
    getAlerts(view.state).map((alert) => {
      return {
        text: view.state.doc.textBetween(alert.from, alert.to),
        id: alert.id,
      };
    });

  /** Resolve the latest request with what the checker would say. */
  const answer = async (index = check.calls.length - 1) => {
    const call = check.calls[index];
    call.resolve(respond(call.text));
    await Promise.resolve();
    await Promise.resolve();
  };

  return {view, controller, check, edit, posOf, shown, answer};
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('check plugin', () => {
  it('highlights what the checker flags', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);

    expect(h.check.calls).toHaveLength(1);
    await h.answer();

    expect(h.shown().map((a) => a.text)).toEqual(['guys', 'chairman']);
  });

  it('debounces: only the last edit in a burst is checked', async () => {
    const h = createHarness(['Hey']);
    vi.advanceTimersByTime(100);
    await h.answer();

    for (const char of ' guys') {
      h.edit((tr) => tr.insertText(char, h.view.state.doc.content.size - 1));
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(100);

    expect(h.check.calls).toHaveLength(2);
    expect(h.check.calls[1].text).toBe('Hey guys');
  });

  it('maps a response through edits made while it was in flight', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);

    // Typed before both alerts while the check is running.
    h.edit((tr) => tr.insertText('Well, ', 1));
    await h.answer(0);

    expect(h.view.state.doc.textContent).toBe('Well, Hey guys, the chairman');
    expect(h.shown().map((a) => a.text)).toEqual(['guys', 'chairman']);
  });

  it('drops an alert whose text was edited while its check was in flight', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);

    const at = h.posOf('chairman');
    h.edit((tr) => tr.insertText('X', at + 5));
    await h.answer(0);

    expect(h.shown().map((a) => a.text)).toEqual(['guys']);
  });

  it('aborts a superseded check and ignores its late response', async () => {
    const h = createHarness(['Hey guys']);
    vi.advanceTimersByTime(100);

    h.edit((tr) =>
      tr.insertText(' and the chairman', h.view.state.doc.content.size - 1)
    );
    vi.advanceTimersByTime(100);

    expect(h.check.calls[0].signal.aborted).toBe(true);
    expect(h.check.calls[1].signal.aborted).toBe(false);

    await h.answer(0);
    expect(h.shown()).toEqual([]);

    await h.answer(1);
    expect(h.shown().map((a) => a.text)).toEqual(['guys', 'chairman']);
  });

  it('removes a highlight at once when its text is edited', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);
    await h.answer();

    h.edit((tr) => tr.insertText('x', h.posOf('guys') + 2));

    expect(h.shown().map((a) => a.text)).toEqual(['chairman']);
  });

  it('keeps highlights on their words while typing elsewhere', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);
    await h.answer();

    h.edit((tr) => tr.insertText('Oh. ', 1));

    expect(h.shown().map((a) => a.text)).toEqual(['guys', 'chairman']);
  });

  it('keeps alert ids stable across a recheck', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);
    await h.answer();
    const before = h.shown();

    // Shifts both alerts, so the ids have to survive a position change.
    h.edit((tr) => tr.insertText('Oh. ', 1));
    vi.advanceTimersByTime(100);
    await h.answer();

    expect(h.shown()).toEqual(before);
  });

  it('checks again on request without an edit', async () => {
    const h = createHarness(['Hey guys']);
    vi.advanceTimersByTime(100);
    await h.answer();

    requestRecheck(h.view);
    vi.advanceTimersByTime(100);

    expect(h.check.calls).toHaveLength(2);
    expect(h.check.calls[1].text).toBe('Hey guys');
  });

  it('does not check during an IME composition, and checks after it', async () => {
    const h = createHarness(['Hey guys']);
    h.view.composing = true;
    vi.advanceTimersByTime(100);

    expect(h.check.calls).toHaveLength(0);

    h.view.composing = false;
    h.controller.compositionEnded();
    vi.advanceTimersByTime(100);

    expect(h.check.calls).toHaveLength(1);
  });

  it('keeps alerts out of the document', async () => {
    const h = createHarness(['Hey guys']);
    const before = h.view.state.doc;
    vi.advanceTimersByTime(100);
    await h.answer();

    expect(h.shown()).toHaveLength(1);
    expect(h.view.state.doc.eq(before)).toBe(true);
  });

  it('ignores results that do not map onto the checked text', async () => {
    const h = createHarness(['Hey guys']);
    vi.advanceTimersByTime(100);

    // Offsets past the end, as a response for some other text would have.
    h.check.calls[0].resolve({
      results: [{text: 'guys', start: 40, end: 44, category: 'x', gravity: 1}],
    } as ICheckResponse);
    await Promise.resolve();
    await Promise.resolve();

    expect(h.shown()).toEqual([]);
  });

  it('stops checking once destroyed', async () => {
    const h = createHarness(['Hey guys']);
    vi.advanceTimersByTime(100);
    h.controller.destroy();

    expect(h.check.calls[0].signal.aborted).toBe(true);
    await h.answer();
    expect(h.shown()).toEqual([]);

    // A late trigger, such as the deferred compositionend handler.
    h.controller.schedule();
    vi.advanceTimersByTime(100);
    expect(h.check.calls).toHaveLength(1);
  });

  it('drops a result whose text is not what sits at its offsets', async () => {
    const h = createHarness(['Hey guys']);
    vi.advanceTimersByTime(100);

    h.check.calls[0].resolve({
      results: [{text: 'guys', start: 0, end: 4, category: 'x', gravity: 1}],
    } as ICheckResponse);
    await Promise.resolve();
    await Promise.resolve();

    expect(h.shown()).toEqual([]);
  });

  it('ignores results for a check that is no longer the current one', () => {
    const h = createHarness(['Hey guys']);
    const results = (id: number) =>
      h.view.state.tr.setMeta(checkPluginKey, {
        type: 'results',
        id,
        alerts: [{from: 5, to: 9, result: {text: 'guys', gravity: 1}}],
      });

    h.view.dispatch(
      h.view.state.tr.setMeta(checkPluginKey, {type: 'start', id: 1})
    );
    h.view.dispatch(
      h.view.state.tr.setMeta(checkPluginKey, {type: 'start', id: 2})
    );
    h.view.dispatch(results(1));
    expect(h.shown()).toEqual([]);

    h.view.dispatch(results(2));
    expect(h.shown().map((a) => a.text)).toEqual(['guys']);
  });
});

describe('alertTone', () => {
  it('follows the extension colour rule', () => {
    const tone = (gravity: number, subcategory = 'x') =>
      alertTone({gravity, subcategory});

    expect(tone(2, 'corporate_rules')).toBe('corporate');
    expect(tone(0)).toBe('inclusive');
    expect(tone(1)).toBe('severe');
    expect(tone(2)).toBe('bias');
    expect(tone(2.5)).toBe('bias');
    expect(tone(3)).toBe('style');
  });
});
