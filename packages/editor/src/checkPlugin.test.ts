import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState, type Transaction} from '@tiptap/pm/state';

import type {ICheckResponse, ICheckResponseResult} from './checkClient';
import {
  CheckController,
  type CheckOptions,
  type CheckView,
  isLimitReached,
  checkPluginKey,
  createCheckPlugin,
  dismissAlerts,
  getAlerts,
  requestRecheck,
  selectAlert,
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
const createHarness = (
  paragraphs: string[],
  check = deferredChecker(),
  options: Partial<CheckOptions> = {}
) => {
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
    ...options,
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

  /** Class attribute of each highlight, in document order. */
  const classes = () =>
    (checkPluginKey.getState(view.state)?.decorations.find() ?? []).map(
      (d) => (d as unknown as {type: {attrs: {class: string}}}).type.attrs.class
    );

  return {view, controller, check, edit, posOf, shown, answer, classes};
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
        alerts: [
          {
            from: 5,
            to: 9,
            detail: {data: {text: 'guys', category: 'x', gravity: 1}},
          },
        ],
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

describe('highlight classes', () => {
  it('follow the extension colour rule, dotted for orthography', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);
    h.check.calls[0].resolve({
      results: [
        {text: 'guys', start: 4, end: 8, category: 'gendered', gravity: 2},
        {
          text: 'chairman',
          start: 14,
          end: 22,
          category: 'orthography',
          gravity: 1,
        },
      ],
    } as ICheckResponse);
    await Promise.resolve();
    await Promise.resolve();

    expect(h.classes()).toEqual([
      'witty-alert witty-alert--bias',
      'witty-alert witty-alert--severe witty-alert--dotted',
    ]);
  });
});

describe('popover support', () => {
  it('draws the selected alert with the fill, and clears it', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);
    await h.answer();
    const [guys] = h.shown();

    selectAlert(h.view, guys.id);
    expect(h.classes()[0]).toContain('witty-alert--selected');
    expect(h.classes()[1]).not.toContain('witty-alert--selected');

    selectAlert(h.view, null);
    expect(h.classes().join(' ')).not.toContain('witty-alert--selected');
  });

  it('keeps the selection on the alert across a recheck', async () => {
    const h = createHarness(['Hey guys, the chairman']);
    vi.advanceTimersByTime(100);
    await h.answer();
    selectAlert(h.view, h.shown()[0].id);

    h.edit((tr) => tr.insertText('Oh. ', 1));
    vi.advanceTimersByTime(100);
    await h.answer();

    expect(h.classes()[0]).toContain('witty-alert--selected');
  });

  it('dismisses every highlight of a term at once', async () => {
    const h = createHarness(['Hey guys, the chairman and guys']);
    vi.advanceTimersByTime(100);
    await h.answer();

    dismissAlerts(h.view, 'guys');

    expect(h.shown().map((a) => a.text)).toEqual(['chairman']);
  });
});

describe('long texts', () => {
  // Five sentences of 23 characters, the flagged word in each.
  const LONG = [1, 2, 3, 4, 5].map((n) => `Guys number ${n} is here.`);
  const longText = LONG.join(' ');

  /** Flags every "Guys" in the request text. */
  const respondGuys = (text: string): ICheckResponse => {
    const results: ICheckResponseResult[] = [];
    for (
      let at = text.indexOf('Guys');
      at !== -1;
      at = text.indexOf('Guys', at + 1)
    ) {
      results.push({
        text: 'Guys',
        start: at,
        end: at + 4,
        category: 'x',
        gravity: 2,
      } as ICheckResponseResult);
    }
    return {results} as ICheckResponse;
  };

  /** Answer every request as it comes, until nothing more is asked. */
  const answerAll = async (h: ReturnType<typeof createHarness>) => {
    for (let round = 0; round < 20; round += 1) {
      vi.advanceTimersByTime(100);
      const open = h.check.calls.filter((call) => !call.signal.aborted);
      const last = open.at(-1);
      if (!last || (last as {answered?: boolean}).answered) return;
      (last as {answered?: boolean}).answered = true;
      last.resolve(respondGuys(last.text));
      await Promise.resolve();
      await Promise.resolve();
    }
  };

  it('checks a text longer than one request, sentence by sentence', async () => {
    const h = createHarness([longText], deferredChecker(), {
      maxRequestLength: 50,
    });
    await answerAll(h);

    // Every request within the budget, every sentence checked once.
    expect(h.check.calls.length).toBeGreaterThan(1);
    for (const call of h.check.calls)
      expect(call.text.length).toBeLessThanOrEqual(50);
    expect(h.check.calls.map((c) => c.text).join(' ')).toBe(longText);
    expect(h.shown()).toHaveLength(5);
    expect(isLimitReached(h.view.state)).toBe(false);
  });

  it('sends only the sentence that changed', async () => {
    const h = createHarness([longText], deferredChecker(), {
      maxRequestLength: 50,
    });
    await answerAll(h);
    const before = h.check.calls.length;

    h.edit((tr) => tr.insertText('!', h.posOf('number 3') + 8));
    await answerAll(h);

    expect(h.check.calls.slice(before).map((c) => c.text)).toEqual([
      'Guys number 3! is here.',
    ]);
    expect(h.shown()).toHaveLength(5);
  });

  it('retries a batch cut short by the API in smaller pieces', async () => {
    const check = deferredChecker();
    const h = createHarness([longText], check, {maxRequestLength: 1000});
    vi.advanceTimersByTime(100);

    // The deployment's limit is lower than assumed: the first batch is cut.
    check.calls[0].resolve({
      ...respondGuys(check.calls[0].text.slice(0, 40)),
      limit_reached: true,
    } as ICheckResponse);
    await Promise.resolve();
    await Promise.resolve();
    // Nothing from the cut batch counts as checked.
    expect(h.shown()).toEqual([]);

    await answerAll(h);
    expect(check.calls[1].text.length).toBeLessThanOrEqual(500);
    expect(h.shown()).toHaveLength(5);
  });

  it('reports a sentence too long to check in one request', async () => {
    const check = deferredChecker();
    const h = createHarness(
      ['Guys ' + 'and more words '.repeat(20) + 'here.'],
      check,
      {
        maxRequestLength: 100,
      }
    );
    vi.advanceTimersByTime(100);
    check.calls[0].resolve({
      ...respondGuys(check.calls[0].text),
      limit_reached: true,
    } as ICheckResponse);
    await Promise.resolve();
    await Promise.resolve();

    expect(h.shown()).toHaveLength(1);
    expect(isLimitReached(h.view.state)).toBe(true);
    vi.advanceTimersByTime(100);
    expect(check.calls).toHaveLength(1);
  });

  it('reports a text longer than maxTextLength, checking only its beginning', async () => {
    const h = createHarness([longText], deferredChecker(), {maxTextLength: 50});
    await answerAll(h);

    expect(h.check.calls.map((c) => c.text)).toEqual([
      LONG.slice(0, 2).join(' '),
    ]);
    expect(h.shown()).toHaveLength(2);
    expect(isLimitReached(h.view.state)).toBe(true);
  });
});
