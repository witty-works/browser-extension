import {Extension} from '@tiptap/core';
import type {Node as PMNode} from '@tiptap/pm/model';
import {
  EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from '@tiptap/pm/state';
import {Mapping} from '@tiptap/pm/transform';
import {Decoration, DecorationSet} from '@tiptap/pm/view';

import {buildSentenceAlertsFromResponse} from '@witty/core/ApiServices/checkService';
import {highlightColorKey} from '@witty/core/constants';
import type {IAlert} from '@witty/core/types';
import type {
  Checker,
  ICheckResponse,
  ICheckResponseResult,
} from './checkClient';
import {
  CheckBudget,
  planBatch,
  resultsBySentence,
  SentenceCache,
  splitSentences,
} from './sentenceCheck';
import {extractText, textRangeToDoc} from './textMap';

/**
 * Checking while typing, under the staleness contract
 * (EDITOR_COMPONENT_PLAN.md, "Result staleness"):
 *
 * - Checks are debounced and each one gets an id; starting a new check aborts
 *   the one in flight, and a response for anything but the current id is
 *   ignored.
 * - Edits made while a check is in flight are recorded as a mapping. The
 *   response is mapped through it, and each alert is kept only if the document
 *   still holds exactly the alert's text at the mapped range — map, then
 *   verify, otherwise discard. The edit itself schedules the next check.
 * - Between checks, highlights follow edits through ProseMirror's decoration
 *   mapping, and an edit inside a highlight removes it at once.
 * - Nothing is checked while an IME composition is in progress.
 * - Alerts never enter the document: they are decorations only, so they do not
 *   travel with copy/paste, undo history or (later) collaboration.
 *
 * Each alert carries the extension's `IAlert`, built by the extension's own
 * `buildSentenceAlertsFromResponse`, so the shared popover gets exactly the
 * data it gets in the extension. Its offsets refer to the checked text; the
 * decoration's `from`/`to` are what is current.
 */

export interface Alert {
  /** Stable across rechecks while the flagged text stays put. */
  id: string;
  from: number;
  to: number;
  detail: IAlert;
}

interface PendingCheck {
  id: number;
  /** Everything that happened to the document since the check started. */
  mapping: Mapping;
}

export interface CheckPluginState {
  decorations: DecorationSet;
  pending: PendingCheck | null;
  /** Bumped by `requestRecheck`; the controller checks when it changes. */
  recheckRequests: number;
  /** The alert whose popover is open, drawn with the highlight fill. */
  selectedId: string | null;
  /**
   * The last check left part of the text unchecked: the text is longer than
   * `maxTextLength`, or a sentence was longer than the API checks at once.
   */
  limitReached: boolean;
}

type CheckMeta =
  | {type: 'recheck'}
  | {type: 'clear'}
  | {type: 'select'; id: string | null}
  | {type: 'dismiss'; text: string}
  | {type: 'start'; id: number}
  | {
      type: 'results';
      id: number;
      alerts: Omit<Alert, 'id'>[];
      limitReached: boolean;
      /** False while further batches of a long text are still to come. */
      complete: boolean;
    };

export const checkPluginKey = new PluginKey<CheckPluginState>('wittyCheck');

const alertKey = ({data}: IAlert, from: number, to: number): string =>
  `${data.category}:${data.text}:${from}:${to}`;

/**
 * Highlight classes, in the extension's look: the colour group from its
 * `highlightColorKey`, a dotted line for orthography as its canvas draws it,
 * and the fill while the alert's popover is open.
 */
const alertClass = ({data}: IAlert, selected: boolean): string =>
  [
    'witty-alert',
    `witty-alert--${highlightColorKey(data.gravity, data.subcategory)}`,
    data.category === 'orthography' && 'witty-alert--dotted',
    selected && 'witty-alert--selected',
  ]
    .filter(Boolean)
    .join(' ');

const decorate = (alert: Alert, selectedId: string | null): Decoration =>
  Decoration.inline(
    alert.from,
    alert.to,
    {
      class: alertClass(alert.detail, alert.id === selectedId),
      'data-alert-id': alert.id,
    },
    {alert}
  );

const alertOf = (decoration: Decoration): Alert => {
  return {
    ...(decoration.spec.alert as Alert),
    from: decoration.from,
    to: decoration.to,
  };
};

/** Rebuild every decoration, e.g. after the selection moved. */
const redecorate = (
  decorations: DecorationSet,
  doc: PMNode,
  selectedId: string | null
): DecorationSet =>
  DecorationSet.create(
    doc,
    decorations.find().map((d) => decorate(alertOf(d), selectedId))
  );

/** Whether the last check left part of the text unchecked. */
export const isLimitReached = (state: EditorState): boolean =>
  checkPluginKey.getState(state)?.limitReached ?? false;

/** Alerts currently shown, in document order. */
export const getAlerts = (state: EditorState): Alert[] =>
  (checkPluginKey.getState(state)?.decorations.find() ?? []).map(alertOf);

/** New-document ranges touched by `tr`. */
const changedRanges = (tr: Transaction): [number, number][] => {
  const ranges: [number, number][] = [];
  tr.mapping.maps.forEach((map, index) => {
    const rest = tr.mapping.slice(index + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      ranges.push([rest.map(newStart, -1), rest.map(newEnd, 1)]);
    });
  });
  return ranges;
};

let nextAlertId = 0;

/**
 * Map a response's alerts from the checked document into the current one and
 * keep those whose text is untouched, reusing the id of an identical alert
 * already on screen.
 */
const acceptResults = (
  alerts: Omit<Alert, 'id'>[],
  mapping: Mapping,
  doc: PMNode,
  current: DecorationSet,
  selectedId: string | null
): DecorationSet => {
  const existing = new Map<string, string>();
  for (const decoration of current.find()) {
    const alert = decoration.spec.alert as Alert;
    existing.set(
      alertKey(alert.detail, decoration.from, decoration.to),
      alert.id
    );
  }

  const accepted: Decoration[] = [];
  for (const alert of alerts) {
    const from = mapping.map(alert.from, 1);
    const to = mapping.map(alert.to, -1);
    if (doc.textBetween(from, to) !== alert.detail.data.text) continue;

    const key = alertKey(alert.detail, from, to);
    const id = existing.get(key) ?? `alert-${(nextAlertId += 1)}`;
    accepted.push(decorate({...alert, id, from, to}, selectedId));
  }

  return DecorationSet.create(doc, accepted);
};

const applyTransaction = (
  tr: Transaction,
  value: CheckPluginState
): CheckPluginState => {
  const meta = tr.getMeta(checkPluginKey) as CheckMeta | undefined;

  if (meta?.type === 'recheck') {
    return {...value, recheckRequests: value.recheckRequests + 1};
  }

  if (meta?.type === 'clear') {
    return {
      ...value,
      decorations: DecorationSet.empty,
      pending: null,
      selectedId: null,
      limitReached: false,
    };
  }

  if (meta?.type === 'select') {
    return {
      ...value,
      selectedId: meta.id,
      decorations: redecorate(value.decorations, tr.doc, meta.id),
    };
  }

  if (meta?.type === 'dismiss') {
    return {
      ...value,
      decorations: value.decorations.remove(
        value.decorations
          .find()
          .filter((d) => alertOf(d).detail.data.text === meta.text)
      ),
    };
  }

  if (meta?.type === 'start') {
    return {...value, pending: {id: meta.id, mapping: new Mapping()}};
  }

  if (meta?.type === 'results') {
    if (value.pending?.id !== meta.id) return value;
    return {
      ...value,
      decorations: acceptResults(
        meta.alerts,
        value.pending.mapping,
        tr.doc,
        value.decorations,
        value.selectedId
      ),
      pending: null,
      limitReached: meta.limitReached,
    };
  }

  if (!tr.docChanged) return value;

  let decorations = value.decorations.map(tr.mapping, tr.doc);
  for (const [start, end] of changedRanges(tr)) {
    const touched = decorations
      .find(start, end)
      .filter((d) => d.from < end && d.to > start);
    if (touched.length) decorations = decorations.remove(touched);
  }

  return {
    ...value,
    decorations,
    pending: value.pending && {
      id: value.pending.id,
      mapping: new Mapping([...value.pending.mapping.maps, ...tr.mapping.maps]),
    },
  };
};

/** The subset of EditorView the controller needs, so tests can drive it. */
export interface CheckView {
  readonly state: EditorState;
  readonly composing: boolean;
  dispatch(tr: Transaction): void;
}

export interface CheckOptions {
  check: Checker;
  /** Debounce after the last edit, in ms. */
  delay: number;
  onError?: (error: unknown) => void;
  /** Alerts to leave out, e.g. terms the user chose to ignore. */
  isIgnored?: (alert: IAlert) => boolean;
  /**
   * Characters per request. The NLP API checks at most TEXT_MAX_LENGTH
   * characters of a text (1000 by default); longer texts are checked in
   * several requests, sentence by sentence. A lower deployment limit is
   * detected and the batches shrink.
   */
  maxRequestLength?: number;
  /** Characters of the text checked at all; the rest is reported as unchecked. */
  maxTextLength?: number;
  /**
   * Identifies everything besides the text that changes results (config,
   * credentials, language). The sentence cache is emptied when it changes.
   */
  cacheScope?: () => string;
}

export const DEFAULT_MAX_REQUEST_LENGTH = 1000;
export const DEFAULT_MAX_TEXT_LENGTH = 20000;

export class CheckController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: AbortController | undefined;
  private checkId = 0;
  private deferredByComposition = false;
  private destroyed = false;
  private readonly cache = new SentenceCache();
  private readonly budget: CheckBudget;
  /** Last detected language, for results assembled purely from the cache. */
  private language = '';

  constructor(
    private readonly view: CheckView,
    private readonly options: CheckOptions
  ) {
    this.budget = new CheckBudget(
      options.maxRequestLength ?? DEFAULT_MAX_REQUEST_LENGTH
    );
    this.schedule();
  }

  update(view: CheckView, prevState: EditorState): void {
    const recheck =
      checkPluginKey.getState(view.state)?.recheckRequests !==
      checkPluginKey.getState(prevState)?.recheckRequests;
    // A recheck is asked for when something besides the text changed, so
    // nothing cached can be trusted.
    if (recheck) this.cache.clear();
    if (recheck || view.state.doc !== prevState.doc) this.schedule();
  }

  /** Called when an IME composition ends; runs a check it had held back. */
  compositionEnded(): void {
    if (this.deferredByComposition) {
      this.deferredByComposition = false;
      this.schedule();
    }
  }

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), this.options.delay);
  }

  run(): void {
    if (this.destroyed) return;
    if (this.view.composing) {
      this.deferredByComposition = true;
      return;
    }

    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;
    const id = (this.checkId += 1);

    const {doc} = this.view.state;
    const map = extractText(doc);
    this.cache.useScope(this.options.cacheScope?.() ?? '');

    // Sentences past maxTextLength are never sent; the rest are checked in
    // batches, one request per run, until every sentence is cached.
    const maxTextLength = this.options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
    const sentences = splitSentences(map.text);
    const inScope = sentences.filter(({end}) => end <= maxTextLength);
    const truncated = inScope.length < sentences.length;
    const batch = planBatch(
      map.text,
      inScope.filter((sentence) => !this.cache.get(sentence)),
      this.budget.value
    );

    this.view.dispatch(
      this.view.state.tr
        .setMeta(checkPluginKey, {type: 'start', id} satisfies CheckMeta)
        .setMeta('addToHistory', false)
    );

    const request = batch
      ? this.options.check(batch.text, controller.signal)
      : Promise.resolve(null);

    request
      .then((response) => {
        if (controller.signal.aborted || this.destroyed) return;

        if (response && batch) {
          if (response.language) this.language = response.language;
          const limited = !!response.limit_reached;
          // A batch cut short by the API is not cached (its tail was never
          // checked); it is sent again in smaller pieces. Only a sentence that
          // is too long on its own is kept, marked as partly checked.
          const retrySmaller =
            limited && batch.parts.length > 1 && this.budget.shrink();
          if (!retrySmaller) {
            const bySentence = resultsBySentence(batch, response.results ?? []);
            for (const [sentence, results] of bySentence) {
              // Each keeps the language its batch was detected as.
              this.cache.set(sentence, {
                results: results.map((result) => {
                  return {
                    ...result,
                    language: result.language || response.language,
                  };
                }),
                partial: limited,
              });
            }
          }
        }

        // The whole text's alerts, from the cache, in the checked text's
        // offsets: what the staleness protocol maps into the current document.
        const results: ICheckResponseResult[] = [];
        let partial = false;
        let remaining = false;
        for (const sentence of inScope) {
          const cached = this.cache.get(sentence);
          if (!cached) {
            remaining = true;
            continue;
          }
          partial ||= cached.partial;
          for (const result of cached.results) {
            results.push({
              ...result,
              start: result.start + sentence.start,
              end: result.end + sentence.start,
            });
          }
        }

        const alerts: Omit<Alert, 'id'>[] = [];
        for (const {alerts: inSentence} of buildSentenceAlertsFromResponse(
          {
            ...(response ?? {}),
            results,
            language: this.language,
            limit_reached: partial,
          } as ICheckResponse,
          map.text
        )) {
          for (const sentenceAlert of inSentence) {
            if (this.options.isIgnored?.(sentenceAlert)) continue;
            const start = sentenceAlert.absOffset;
            const end = start + sentenceAlert.data.text.length;
            const range = textRangeToDoc(map, start, end);
            // The popover measures offsets against fullSentence.range, which
            // is absolute in the checked text; so are these, as in the
            // extension (checkService makes them sentence-relative).
            const detail = {
              ...sentenceAlert,
              startOffset: start,
              endOffset: end,
            };
            if (range) alerts.push({...range, detail});
          }
        }

        this.view.dispatch(
          this.view.state.tr
            .setMeta(checkPluginKey, {
              type: 'results',
              id,
              alerts,
              limitReached: truncated || partial,
              complete: !remaining,
            } satisfies CheckMeta)
            .setMeta('addToHistory', false)
        );

        // More sentences to go: the next batch right away. An edit in the
        // meantime reschedules with the usual debounce instead.
        if (remaining) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.run(), 0);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || this.destroyed) return;
        this.options.onError?.(error);
      });
  }

  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.inFlight?.abort();
  }
}

export const createCheckPlugin = (options: CheckOptions): Plugin => {
  let controller: CheckController | undefined;

  return new Plugin<CheckPluginState>({
    key: checkPluginKey,
    state: {
      init: (): CheckPluginState => {
        return {
          decorations: DecorationSet.empty,
          pending: null,
          recheckRequests: 0,
          selectedId: null,
          limitReached: false,
        };
      },
      apply: applyTransaction,
    },
    props: {
      decorations: (state) => checkPluginKey.getState(state)?.decorations,
      handleDOMEvents: {
        compositionend: (): boolean => {
          // The view clears `composing` after this event; wait a tick.
          setTimeout(() => controller?.compositionEnded());
          return false;
        },
      },
    },
    view: (view): CheckController => {
      controller = new CheckController(view, options);
      return controller;
    },
  });
};

/**
 * Check again without an edit, e.g. after the credentials changed. Goes through
 * the debounce like any edit.
 */
export const requestRecheck = (
  view: Pick<CheckView, 'state' | 'dispatch'>
): void =>
  view.dispatch(
    view.state.tr
      .setMeta(checkPluginKey, {type: 'recheck'} satisfies CheckMeta)
      .setMeta('addToHistory', false)
  );

/**
 * Remove every highlight, e.g. when the API refuses the text; an open popover
 * closes with its alert.
 */
export const clearAlerts = (
  view: Pick<CheckView, 'state' | 'dispatch'>
): void =>
  view.dispatch(
    view.state.tr
      .setMeta(checkPluginKey, {type: 'clear'} satisfies CheckMeta)
      .setMeta('addToHistory', false)
  );

/** Draw `id`'s highlight as selected (its popover is open), or none. */
export const selectAlert = (
  view: Pick<CheckView, 'state' | 'dispatch'>,
  id: string | null
): void =>
  view.dispatch(
    view.state.tr
      .setMeta(checkPluginKey, {type: 'select', id} satisfies CheckMeta)
      .setMeta('addToHistory', false)
  );

/** Remove every highlight of `text` now, e.g. after "ignore once". */
export const dismissAlerts = (
  view: Pick<CheckView, 'state' | 'dispatch'>,
  text: string
): void =>
  view.dispatch(
    view.state.tr
      .setMeta(checkPluginKey, {type: 'dismiss', text} satisfies CheckMeta)
      .setMeta('addToHistory', false)
  );

/** TipTap wrapper around `createCheckPlugin`. */
export const WittyCheck = Extension.create<CheckOptions>({
  name: 'wittyCheck',

  addOptions(): CheckOptions {
    return {
      check: (): Promise<ICheckResponse> =>
        Promise.reject(new Error('WittyCheck: no checker')),
      delay: 500,
    };
  },

  addProseMirrorPlugins(): Plugin[] {
    return [createCheckPlugin(this.options)];
  },
});
