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

import type {
  Checker,
  ICheckResponse,
  ICheckResponseResult,
} from './checkClient';
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
 */

export interface Alert {
  /** Stable across rechecks while the flagged text stays put. */
  id: string;
  from: number;
  to: number;
  result: ICheckResponseResult;
}

interface PendingCheck {
  id: number;
  /** Everything that happened to the document since the check started. */
  mapping: Mapping;
}

export interface CheckPluginState {
  decorations: DecorationSet;
  pending: PendingCheck | null;
}

type CheckMeta =
  | {type: 'start'; id: number}
  | {type: 'results'; id: number; alerts: Omit<Alert, 'id'>[]};

export const checkPluginKey = new PluginKey<CheckPluginState>('wittyCheck');

const alertKey = (
  result: ICheckResponseResult,
  from: number,
  to: number
): string => `${result.category}:${result.text}:${from}:${to}`;

export type AlertTone = 'corporate' | 'inclusive' | 'severe' | 'bias' | 'style';

/**
 * Colour group of an alert: the same rule as the extension's `getColor`
 * (source/shared/constants.ts), which cannot be imported without pulling in
 * extension code. Shared from packages/core after the Phase 2 extraction.
 */
export const alertTone = ({
  gravity,
  subcategory,
}: Pick<ICheckResponseResult, 'gravity' | 'subcategory'>): AlertTone => {
  if (subcategory === 'corporate_rules') return 'corporate';
  if (!gravity) return 'inclusive';
  if (gravity < 1.5) return 'severe';
  if (gravity > 2.5) return 'style';
  return 'bias';
};

const decorate = (alert: Alert): Decoration =>
  Decoration.inline(
    alert.from,
    alert.to,
    {
      class: `witty-alert witty-alert--${alertTone(alert.result)}`,
      'data-alert-id': alert.id,
    },
    {alert}
  );

/** Alerts currently shown, in document order. */
export const getAlerts = (state: EditorState): Alert[] =>
  (checkPluginKey.getState(state)?.decorations.find() ?? []).map((d) => {
    return {
      ...(d.spec.alert as Alert),
      from: d.from,
      to: d.to,
    };
  });

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
  current: DecorationSet
): DecorationSet => {
  const existing = new Map<string, string>();
  for (const decoration of current.find()) {
    const alert = decoration.spec.alert as Alert;
    existing.set(
      alertKey(alert.result, decoration.from, decoration.to),
      alert.id
    );
  }

  const accepted: Decoration[] = [];
  for (const alert of alerts) {
    const from = mapping.map(alert.from, 1);
    const to = mapping.map(alert.to, -1);
    if (doc.textBetween(from, to) !== alert.result.text) continue;

    const key = alertKey(alert.result, from, to);
    const id = existing.get(key) ?? `alert-${(nextAlertId += 1)}`;
    accepted.push(decorate({...alert, id, from, to}));
  }

  return DecorationSet.create(doc, accepted);
};

const applyTransaction = (
  tr: Transaction,
  value: CheckPluginState
): CheckPluginState => {
  const meta = tr.getMeta(checkPluginKey) as CheckMeta | undefined;

  if (meta?.type === 'start') {
    return {...value, pending: {id: meta.id, mapping: new Mapping()}};
  }

  if (meta?.type === 'results') {
    if (value.pending?.id !== meta.id) return value;
    return {
      decorations: acceptResults(
        meta.alerts,
        value.pending.mapping,
        tr.doc,
        value.decorations
      ),
      pending: null,
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
}

export class CheckController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: AbortController | undefined;
  private checkId = 0;
  private deferredByComposition = false;
  private destroyed = false;

  constructor(
    private readonly view: CheckView,
    private readonly options: CheckOptions
  ) {
    this.schedule();
  }

  update(view: CheckView, prevState: EditorState): void {
    if (view.state.doc !== prevState.doc) this.schedule();
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

    this.view.dispatch(
      this.view.state.tr
        .setMeta(checkPluginKey, {type: 'start', id} satisfies CheckMeta)
        .setMeta('addToHistory', false)
    );

    const request = map.text
      ? this.options.check(map.text, controller.signal)
      : Promise.resolve({results: []} as unknown as ICheckResponse);

    request
      .then((response) => {
        if (controller.signal.aborted || this.destroyed) return;

        const alerts: Omit<Alert, 'id'>[] = [];
        for (const result of response.results) {
          const range = textRangeToDoc(map, result.start, result.end);
          if (range) alerts.push({...range, result});
        }

        this.view.dispatch(
          this.view.state.tr
            .setMeta(checkPluginKey, {
              type: 'results',
              id,
              alerts,
            } satisfies CheckMeta)
            .setMeta('addToHistory', false)
        );
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
        return {decorations: DecorationSet.empty, pending: null};
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
