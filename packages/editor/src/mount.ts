import {Editor, Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Plugin} from '@tiptap/pm/state';

import {highlightColors} from '@witty/core/constants';
import i18n from 'i18next';
import {initI18n} from '@witty/i18n/i18n';
import {namespaces} from '@witty/i18n/i18n.constants';
import {
  credentialHeaders,
  LLM_SUGGESTION_TIMEOUT_MS,
} from '@witty/core/ApiServices/requests';
import {
  type CheckConfig,
  type Checker,
  CheckHttpError,
  type CheckLang,
  createHttpChecker,
} from './checkClient';
import {
  checkPluginKey,
  getAlerts,
  isLimitReached,
  requestRecheck,
  WittyCheck,
} from './checkPlugin';
import {
  applyAlerts,
  bulkAlerts,
  GENDER_FORMAT_BULK,
  type GenderFormatSwitchResult,
  noSwitchReason,
  SWITCHABLE_FORMATS,
  switchRequestConfig,
} from './genderSwitch';
import {PopoverHost} from './popover';
import {
  type CheckStatus,
  createSettingsStore,
  createStore,
  type EditorSettings,
} from './settings';
import {
  createOptionsLoader,
  mountToolbar,
  switchMessage,
  TOOLBAR_STYLES,
} from './toolbar';

/** Marks the switch's own edit, which must not clear its message. */
const SWITCH_META = 'wittyGenderFormatSwitch';

/**
 * Embeddable entry point: `WittyEditor.mount(element, options)`. The PoC shape
 * of the component API; the custom element (`<witty-editor>`) wraps this in
 * Phase 3.
 */

export type EditorStatus =
  /**
   * `limitReached`: part of the text was not checked, because it is longer
   * than `maxTextLength` or a sentence exceeds what the API checks at once.
   */
  | {
      state: 'idle';
      alerts: number;
      limitReached: boolean;
      /** Set once, on the status right after a gender format switch. */
      genderFormatSwitch?: GenderFormatSwitchResult;
    }
  | {state: 'unauthorized'}
  | {state: 'error'; message: string};

export interface MountOptions {
  /** NLP API base URL with trailing slash; defaults to the page's origin. */
  endpoint?: string;
  /** Sent as `x-key`. Set later with `setApiKey`; never read from the DOM. */
  apiKey?: string;
  /** Language of the text, or `auto` (the default) to let the API detect it. */
  lang?: CheckLang;
  /**
   * Per-request check config. Only the fields set here are sent, so the user's
   * stored settings keep deciding the rest. Replace it later with `setConfig`.
   */
  config?: CheckConfig;
  /** Initial content (HTML). */
  content?: string;
  /**
   * The formatting bar with the Witty settings button (categories, gender
   * formats, spelling, AI suggestions). On by default.
   */
  toolbar?: boolean;
  /** Called when the user changes a setting in the settings panel. */
  onSettingsChange?: (settings: EditorSettings) => void;
  /** Accessible name of the editable area. */
  label?: string;
  /**
   * Ids of elements that further describe the editable area, separated by
   * spaces; added to its `aria-describedby` after the component's own hint.
   */
  describedBy?: string;
  /**
   * Characters per check request; longer texts are checked sentence by
   * sentence over several requests. Match the API's TEXT_MAX_LENGTH (1000 by
   * default); a lower limit is detected and batches shrink.
   */
  maxRequestLength?: number;
  /** Characters of the text checked at all (default 20000). */
  maxTextLength?: number;
  /** Debounce after the last edit, in ms. */
  delay?: number;
  /**
   * Offer the LLM's sentence rewrites in the popover (`/v1.0/rephrase`). The
   * extension takes this from the organisation config.
   */
  llmAlternatives?: boolean;
  /**
   * How long to wait for the rewrites, in ms. The extension's 3s suits a
   * hosted model; a local one (Ollama) needs longer.
   */
  llmTimeoutMs?: number;
  onStatus?: (status: EditorStatus) => void;
}

export interface WittyEditorHandle {
  editor: Editor;
  /** Replace the API key (empty string clears it) and check again. */
  setApiKey(key: string): void;
  /**
   * Replace the whole check config — this does not merge — and check again.
   * `{}` goes back to sending no `config`, i.e. the account's own settings.
   */
  setConfig(config: CheckConfig): void;
  /** Plain text of the document. */
  getText(): string;
  /**
   * The current settings: what `onSettingsChange` receives, as a copy. For a
   * host that sends the same `config` with its own API calls.
   */
  getSettings(): EditorSettings;
  /**
   * Rewrite every gendered form in the text into `target` (a German gender
   * ending such as ':in'), in one undoable step, and make it the configured
   * format. Resolves once the text has been checked and switched. Needs an NLP
   * API with bulk alerts; see the README.
   */
  switchGenderFormat(target: string): Promise<GenderFormatSwitchResult>;
  destroy(): void;
}

export type {CheckConfig, CheckLang, CheckVariant} from './checkClient';
export type {EditorSettings} from './settings';
export type {GenderFormatSwitchResult, SwitchOutcome} from './genderSwitch';

/**
 * Highlights in the extension's look, with its colours: a 2px line in the
 * group colour (dotted for orthography) and, while the popover is open, the
 * rounded fill at 20% opacity.
 */
const buildStyles = (): string =>
  [
    '.witty-editor .ProseMirror { outline: none; min-height: 8rem; }',
    // Its own focus indicator rather than relying on the host page for one.
    '.witty-editor-limit { margin: 0.25rem 0 0; font-size: 0.875em; color: #595959; }',
    '.witty-editor .ProseMirror:focus-visible { outline: 2px solid #55b8e9; outline-offset: 2px; border-radius: 2px; }',
    // Read by screen readers, not shown.
    '.witty-editor-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }',
    TOOLBAR_STYLES,
    '.witty-alert { border-bottom: 2px solid transparent; cursor: pointer; }',
    '.witty-alert--dotted { border-bottom-style: dotted; border-bottom-width: 3px; }',
    '.witty-alert--selected { background-color: var(--witty-alert-fill); border-radius: 4px; }',
    ...Object.entries(highlightColors).map(
      ([key, colors]) =>
        `.witty-alert--${key} { border-bottom-color: ${colors.hover}; --witty-alert-fill: ${colors.highlight}33; }`
    ),
  ].join('\n');

const STYLE_ID = 'witty-editor-styles';

const injectStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildStyles();
  document.head.append(style);
};

/** Opens the popover on a click on a highlight, and on the shortcut. */
const popoverTriggers = (host: () => PopoverHost | undefined): Extension =>
  Extension.create({
    name: 'wittyPopoverTriggers',

    addKeyboardShortcuts() {
      return {
        // The extension's default for its open-highlight-popover command.
        'Alt-Shift-w': (): boolean => host()?.openAtSelection() ?? false,
      };
    },

    addProseMirrorPlugins(): Plugin[] {
      return [
        new Plugin({
          props: {
            handleClick: (view, pos): boolean => {
              const alert = getAlerts(view.state).find(
                (candidate) => candidate.from <= pos && pos < candidate.to
              );
              if (!alert) return false;
              // After this click has reached the open popover's
              // click-outside handler, which would otherwise close the new one.
              setTimeout(() => host()?.open(alert.id));
              return false;
            },
          },
        }),
      ];
    },
  });

let nextEditorId = 0;

export const mount = (
  element: HTMLElement,
  {
    endpoint = `${location.origin}/`,
    apiKey = '',
    lang = 'auto',
    config,
    content = '',
    toolbar = true,
    onSettingsChange,
    label = 'Text to check',
    describedBy,
    maxRequestLength,
    maxTextLength,
    delay = 500,
    llmAlternatives = false,
    llmTimeoutMs = LLM_SUGGESTION_TIMEOUT_MS,
    onStatus,
  }: MountOptions = {}
): WittyEditorHandle => {
  initI18n();
  injectStyles();
  element.classList.add('witty-editor');

  let key = apiKey;
  // Behind `config`/`setConfig`, the settings panel and the popover's AI
  // suggestions alike, so none of them can disagree.
  const settings = createSettingsStore({
    config: config ?? {},
    llmAlternatives,
    orthography: true,
  });
  const headers = (): Record<string, string> =>
    credentialHeaders({apiKey: key});
  // While a gender format switch runs, its checks use this config instead:
  // the user's, with the gender-format alerts switched on. Never stored.
  let switchConfig: CheckConfig | null = null;
  const requestConfig = (): CheckConfig =>
    switchConfig ?? settings.get().config;
  // Whether the API sends bulk alerts: known once one arrives, or once a
  // switch finds an API that predates them.
  let bulkSupport: 'unknown' | 'yes' | 'no' = 'unknown';
  // Both are read per request, so `setApiKey` and settings changes reach the
  // next check without rebuilding the checker.
  const httpCheck = createHttpChecker({
    endpoint,
    headers,
    lang,
    config: requestConfig,
  });
  const check: Checker = async (text, signal) => {
    const response = await httpCheck(text, signal);
    if (response.results?.some((result) => result.bulk === GENDER_FORMAT_BULK))
      bulkSupport = 'yes';
    return response;
  };

  // Callers waiting for the next complete check (a switch): armed when a
  // check starts after they began waiting, settled by its last batch.
  interface CheckWaiter {
    armed: boolean;
    resolve: (limitReached: boolean) => void;
    reject: (error: unknown) => void;
  }
  const waiters = new Set<CheckWaiter>();
  const nextCompleteCheck = (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      waiters.add({armed: false, resolve, reject});
    });

  // Highlights are visual only; tell screen reader users how to reach them.
  const hint = document.createElement('span');
  hint.id = `witty-editor-hint-${(nextEditorId += 1)}`;
  hint.className = 'witty-editor-sr-only';
  hint.textContent = i18n.t('shortcutHint', {ns: namespaces.editor});

  const editableAttributes = (): Record<string, string> => {
    return {
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': label,
      'aria-describedby': [hint.id, describedBy].filter(Boolean).join(' '),
      // Witty checks spelling; two sets of underlines would compete.
      spellcheck: settings.get().orthography ? 'false' : 'true',
    };
  };

  // Toolbar first, then the editable; both inside the host's element.
  const toolbarHost = document.createElement('div');
  const editorHost = document.createElement('div');
  // Visible as well as announced, for hosts that do not read limitReached.
  const limitHint = document.createElement('p');
  limitHint.className = 'witty-editor-limit';
  limitHint.hidden = true;
  limitHint.textContent = i18n.t('limitReached', {ns: namespaces.editor});

  element.append(
    ...(toolbar ? [toolbarHost] : []),
    editorHost,
    limitHint,
    hint
  );

  // What the Witty button shows; the host's onStatus keeps its own shape.
  const status = createStore<{status: CheckStatus; notice: string | null}>({
    status: {state: 'idle', alerts: 0, limitReached: false},
    notice: null,
  });
  const ignored = new Set<string>();
  // Created once the editor exists; its triggers only fire after that.
  const popoverRef: {current?: PopoverHost} = {};

  const editor = new Editor({
    element: editorHost,
    extensions: [
      StarterKit,
      WittyCheck.configure({
        check,
        delay,
        maxRequestLength,
        maxTextLength,
        // Results depend on these as much as on the text.
        cacheScope: (): string => JSON.stringify([requestConfig(), lang, key]),
        isIgnored: (alert) => ignored.has(alert.data.text),
        onError: (error) => {
          const next: EditorStatus =
            error instanceof CheckHttpError &&
            (error.status === 401 || error.status === 403)
              ? {state: 'unauthorized'}
              : {
                  state: 'error',
                  message:
                    error instanceof Error ? error.message : String(error),
                };
          status.set({status: next});
          onStatus?.(next);
          waiters.forEach((waiter) => waiter.reject(error));
          waiters.clear();
        },
      }),
      popoverTriggers(() => popoverRef.current),
    ],
    content,
    // TipTap spreads `attributes` into its own, so it has to be an object;
    // it is replaced when the spelling setting changes.
    editorProps: {attributes: editableAttributes()},
    onTransaction: ({editor: current, transaction}): void => {
      popoverRef.current?.update();
      // Report whenever the highlights may have changed: results landed, an
      // edit removed some, or "ignore once" dismissed them.
      const meta = transaction.getMeta(checkPluginKey) as
        {type?: string; complete?: boolean} | undefined;
      if (meta?.type === 'start') {
        status.set({status: {state: 'checking'}});
        waiters.forEach((waiter) => {
          waiter.armed = true;
        });
      }
      if (meta?.type === 'results' && meta.complete !== false) {
        for (const waiter of waiters) {
          if (!waiter.armed) continue;
          waiter.resolve(isLimitReached(current.state));
          waiters.delete(waiter);
        }
      }
      // A switch's message stays until the user edits the text.
      if (transaction.docChanged && !transaction.getMeta(SWITCH_META)) {
        if (status.get().notice) status.set({notice: null});
      }
      if (
        transaction.docChanged ||
        meta?.type === 'results' ||
        meta?.type === 'dismiss'
      ) {
        const idle = {
          state: 'idle',
          alerts: getAlerts(current.state).length,
          limitReached: isLimitReached(current.state),
        } as const;
        // Settled by results of the last batch or a dismissal. An edit during
        // a check leaves it checking, as do results of an unfinished long text.
        const settled =
          meta?.type === 'dismiss' ||
          (meta?.type === 'results' && meta.complete !== false) ||
          (meta === undefined && status.get().status.state !== 'checking');
        if (settled) {
          status.set({status: idle});
          limitHint.hidden = !idle.limitReached;
        }
        onStatus?.(idle);
      }
    },
  });

  const popover = new PopoverHost(editor.view, {
    endpoint,
    headers,
    llmAlternatives: (): boolean => settings.get().llmAlternatives,
    llmTimeoutMs,
    ignored,
    config: (): CheckConfig => settings.get().config,
  });
  popoverRef.current = popover;

  // Any settings change: rewrites made under the old ones are stale, the text
  // needs checking again, and the spellcheck attribute may flip.
  let previous = settings.get();
  const unsubscribe = settings.subscribe(() => {
    const next = settings.get();
    if (
      next.config !== previous.config ||
      next.llmAlternatives !== previous.llmAlternatives
    ) {
      popover.resetRewrites();
    }
    if (next.config !== previous.config) {
      requestRecheck(editor.view);
    }
    if (next.orthography !== previous.orthography) {
      editor.setOptions({editorProps: {attributes: editableAttributes()}});
    }
    previous = next;
  });

  const loadOptions = createOptionsLoader({endpoint, headers});
  const t = (name: string, options?: Record<string, unknown>): string =>
    i18n.t(name, {ns: namespaces.editor, ...options});

  let switching: Promise<GenderFormatSwitchResult> | null = null;

  const runSwitch = async (
    target: string
  ): Promise<GenderFormatSwitchResult> => {
    const ending = target as NonNullable<CheckConfig['german_gender_ending']>;
    if (!SWITCHABLE_FORMATS.includes(ending)) {
      return {outcome: 'unavailable', target, count: 0, limitReached: false};
    }

    // 1. The target becomes the configured format (the toolbar shows it), and
    //    the switch's checks ask for the gender-format alerts regardless of
    //    the user's category settings, which stay as they are.
    const userConfig = {
      ...settings.get().config,
      german_gender_ending: ending,
    };
    switchConfig = switchRequestConfig(userConfig, ending).config;
    const checked = nextCompleteCheck();
    settings.set({config: userConfig});
    requestRecheck(editor.view);

    let limitReached: boolean;
    try {
      // 2. Every batch of the text, not only the first.
      limitReached = await checked;
    } finally {
      switchConfig = null;
    }

    // 3. All bulk alerts in one transaction: one undo restores the text.
    const alerts = getAlerts(editor.state);
    const bulk = bulkAlerts(alerts);
    let result: GenderFormatSwitchResult;
    if (bulk.length) {
      editor.view.dispatch(
        applyAlerts(editor.state, bulk).setMeta(SWITCH_META, true)
      );
      result = {
        outcome: 'switched',
        target,
        count: bulk.length,
        limitReached,
      };
    } else {
      const outcome = noSwitchReason(
        editor.state.doc.textContent,
        target,
        alerts
      );
      if (outcome === 'unsupported') bulkSupport = 'no';
      result = {outcome, target, count: 0, limitReached};
    }
    // Back to the user's own settings for the underlines.
    requestRecheck(editor.view);

    // 4. Said in the live region and to the host.
    const options = await loadOptions().catch(() => null);
    status.set({notice: switchMessage(t, result, options)});
    onStatus?.({
      state: 'idle',
      alerts: getAlerts(editor.state).length,
      limitReached: isLimitReached(editor.state),
      genderFormatSwitch: result,
    });
    return result;
  };

  const switchGenderFormat = (
    target: string
  ): Promise<GenderFormatSwitchResult> => {
    // One at a time: a second request waits for the running one.
    switching = (switching ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => runSwitch(target));
    return switching;
  };

  const toolbarHandle = toolbar
    ? mountToolbar(toolbarHost, {
        editor,
        store: {
          ...settings,
          // Changes from the panel are the user's; tell the host.
          set: (next): void => {
            settings.set(next);
            onSettingsChange?.(settings.get());
          },
        },
        status,
        loadOptions,
        onSwitch: async (target) => {
          const result = await switchGenderFormat(target);
          // Chosen in the menu: the gender format setting is the user's.
          onSettingsChange?.(settings.get());
          return result;
        },
        switchSupported: (): boolean => bulkSupport !== 'no',
      })
    : undefined;

  return {
    editor,
    setApiKey(next: string): void {
      key = next;
      popover.resetRewrites();
      requestRecheck(editor.view);
    },
    setConfig(next: CheckConfig): void {
      // Replaces, never merges; the store's subscriber re-checks.
      settings.set({config: next});
    },
    getText: (): string => editor.getText(),
    switchGenderFormat,
    getSettings: (): EditorSettings => {
      const current = settings.get();
      return {...current, config: structuredClone(current.config)};
    },
    destroy: (): void => {
      unsubscribe();
      toolbarHandle?.destroy();
      popover.destroy();
      editor.destroy();
      toolbarHost.remove();
      editorHost.remove();
      hint.remove();
      limitHint.remove();
    },
  };
};
