import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {EditorView} from '@tiptap/pm/view';

// The extension's popover, unchanged: same UI, same view model, same styles.
import HighlightPopover from '@witty/ui/HighlightPopover';
import type {PopoverAnalytics} from '@witty/ui/popoverViewModel';
import {
  buildResolvedCacheValue,
  createLoadingCacheValue,
  getLLMAlternativesCacheKey,
  type LLMAlternativesCacheValue,
} from '@witty/core/ApiServices/llmAlternativesService';
import {
  buildLLMSuggestionBody,
  JSON_HEADERS,
  REPHRASE_PATH,
} from '@witty/core/ApiServices/requests';
import type {
  CustomInputElement,
  IGetLLMSuggestionsRequest,
} from '@witty/core/types';
import {type Alert, dismissAlerts, getAlerts, selectAlert} from './checkPlugin';
import {type CheckConfig, genderSeparatorFor} from './checkClient';
import {resolveReplacement} from './replacement';

/**
 * Hosts the extension's highlight popover over the editor's highlights: the
 * editor-side counterpart of what ContentScript/Input.tsx does for a page's
 * input. Text changes are editor transactions, so they are undoable and never
 * need the extension's synthetic-input workarounds.
 */

// The editor reports nothing; a host that wants events can wrap this later.
const noAnalytics: PopoverAnalytics = {
  popoverLogs: () => undefined,
  alternativeLog: () => undefined,
  ignoreLog: () => undefined,
};

export interface PopoverHostOptions {
  endpoint: string;
  headers: () => Record<string, string>;
  /** Offer the LLM's sentence rewrites for the alternatives. */
  llmAlternatives: boolean;
  /** How long to wait for them before the plain alternatives stand alone. */
  llmTimeoutMs: number;
  /** Terms ignored this session; filtered from later checks as well. */
  ignored: Set<string>;
  /** The check config, so rewrites use the same gender format. */
  config: () => CheckConfig | undefined;
}

export class PopoverHost {
  private readonly container: HTMLElement;
  private readonly root: Root;
  private openId: string | null = null;
  private focusOnOpen = false;
  private prevData: React.ComponentProps<typeof HighlightPopover>['prevData'] =
    null;
  private readonly llmCache = new Map<string, LLMAlternativesCacheValue>();
  /** Bumped by `resetRewrites`; answers from an older generation are dropped. */
  private rewriteGeneration = 0;
  private destroyed = false;

  constructor(
    private readonly view: EditorView,
    private readonly options: PopoverHostOptions
  ) {
    this.container = document.createElement('div');
    this.container.className = 'witty-editor-popover';
    document.body.append(this.container);
    this.root = createRoot(this.container);
  }

  get isOpen(): boolean {
    return this.openId !== null;
  }

  open(id: string, {viaKeyboard = false} = {}): void {
    if (this.destroyed) return;
    this.focusOnOpen = viaKeyboard;
    this.openId = id;
    selectAlert(this.view, id);
    this.render();
  }

  /** Open the alert under the caret, as the extension's shortcut does. */
  openAtSelection(): boolean {
    const {from} = this.view.state.selection;
    const alert = getAlerts(this.view.state).find(
      (candidate) => candidate.from <= from && from <= candidate.to
    );
    if (!alert) return false;
    this.open(alert.id, {viaKeyboard: true});
    return true;
  }

  close(): void {
    if (this.openId === null) return;
    this.openId = null;
    this.prevData = null;
    selectAlert(this.view, null);
    this.root.render(null);
  }

  /** Follow the document: re-anchor, or close when the alert is gone. */
  update(): void {
    if (this.openId === null) return;
    if (!this.current()) {
      this.close();
      return;
    }
    this.render();
  }

  /**
   * Forget the LLM rewrites, e.g. after the key or the gender format changed:
   * a cached answer was produced with the old ones. Requests still in flight
   * are ignored when they arrive.
   */
  resetRewrites(): void {
    this.llmCache.clear();
    this.rewriteGeneration += 1;
  }

  destroy(): void {
    // Late callbacks (a rewrite arriving, a click's deferred open) must not
    // render into the unmounted root.
    this.destroyed = true;
    this.openId = null;
    this.root.unmount();
    this.container.remove();
  }

  private current(): Alert | undefined {
    return getAlerts(this.view.state).find((alert) => alert.id === this.openId);
  }

  private render(): void {
    if (this.destroyed) return;
    const alerts = getAlerts(this.view.state);
    const index = alerts.findIndex((alert) => alert.id === this.openId);
    const alert = alerts[index];
    if (!alert) {
      this.close();
      return;
    }

    const start = this.view.coordsAtPos(alert.from);
    const end = this.view.coordsAtPos(alert.to);
    const data = {
      // 1-based, as the extension counts ("1 of 3").
      index: index + 1,
      totalAlerts: alerts.length,
      alert: alert.detail,
      position: new DOMRect(
        start.left,
        start.top,
        Math.max(end.right - start.left, 1),
        start.bottom - start.top
      ),
      node: this.view.domAtPos(alert.from).node,
    };

    this.root.render(
      <HighlightPopover
        analytics={noAnalytics}
        element={this.view.dom as unknown as CustomInputElement}
        data={data}
        prevData={this.prevData}
        hide={() => this.close()}
        updateTextWithAlternative={(chosen) => this.apply(alert, chosen)}
        addIgnoredTerm={(term) => {
          this.options.ignored.add(term);
          dismissAlerts(this.view, term);
        }}
        movePopoverNextOrPrev={(direction) => this.move(index, direction)}
        setLLMSuggestionsRequest={(request) => this.requestRewrites(request)}
        getLLMSuggestions={(request) =>
          this.llmCache.get(getLLMAlternativesCacheKey(request))
        }
        focusOnOpen={this.focusOnOpen}
        llmAlternativesEnabled={this.options.llmAlternatives}
        dashboardAvailable={false}
        ignoreTermPermanently={() =>
          Promise.reject(new Error('no dashboard to persist ignores to'))
        }
        onAlternativeAccepted={() => undefined}
      />
    );
    this.prevData = data;
  }

  /** The popover hides its arrows at either end, so there is no wrapping. */
  private move(index: number, direction: string): void {
    const target = getAlerts(this.view.state)[
      index + (direction === 'previous' ? -1 : 1)
    ];
    if (target) this.open(target.id, {viaKeyboard: this.focusOnOpen});
  }

  private apply(alert: Alert, chosen: string): void {
    // Closing dispatches (it clears the selection), so read the state after.
    this.close();
    const {state} = this.view;
    const {from, to, text} = resolveReplacement(
      state.doc,
      alert,
      chosen,
      this.llmCache.get(getLLMAlternativesCacheKey({alert: alert.detail}))?.data
        ?.results
    );
    const tr = text
      ? state.tr.insertText(text, from, to)
      : state.tr.delete(from, to);
    this.view.dispatch(tr.scrollIntoView());
    this.view.focus();
  }

  private rewriteBody(request: IGetLLMSuggestionsRequest): object {
    const body = buildLLMSuggestionBody(
      request.alert.data.fullSentence,
      request.alert
    );
    const separator = genderSeparatorFor(
      request.alert.data.language,
      this.options.config()
    );
    return separator ? {...body, gender_separator: separator} : body;
  }

  private requestRewrites(request: IGetLLMSuggestionsRequest): void {
    const key = getLLMAlternativesCacheKey(request);
    // A failure is not final: the next time the popover asks, try again.
    const cached = this.llmCache.get(key);
    if (cached && !cached.error) return;

    const generation = this.rewriteGeneration;
    this.llmCache.set(key, createLoadingCacheValue());
    this.render();

    fetch(`${this.options.endpoint}${REPHRASE_PATH}`, {
      method: 'POST',
      headers: {...JSON_HEADERS, ...this.options.headers()},
      body: JSON.stringify(this.rewriteBody(request)),
      signal: AbortSignal.timeout(this.options.llmTimeoutMs),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return buildResolvedCacheValue(await response.json(), null);
      })
      .catch((error: unknown) =>
        buildResolvedCacheValue(null, {message: String(error)} as never)
      )
      .then((value) => {
        if (this.destroyed || generation !== this.rewriteGeneration) return;
        this.llmCache.set(key, value);
        if (this.openId !== null) this.render();
      });
  }
}
