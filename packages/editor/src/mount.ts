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
  LANGUAGE_NOT_SUPPORTED,
  createHttpChecker,
} from './checkClient';
import {
  checkPluginKey,
  clearAlerts,
  getAlerts,
  getTextLanguages,
  isLimitReached,
  requestRecheck,
  WittyCheck,
} from './checkPlugin';
import {
  applyEdits,
  decideSwitch,
  GENDER_FORMAT_BULK,
  type GenderFormatSwitchResult,
  FORMAT_FIELD,
  formatLanguage,
  INKLUSIVUM,
  SWITCHABLE_FORMATS,
  type SwitchCheckInfo,
  type SwitchLanguage,
  switchRequestConfig,
} from './genderSwitch';
import type {EditorStatus, Mount, MountOptions, WittyEditorHandle} from './api';
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

/**
 * A random id for `installationId`. `crypto.randomUUID` needs a secure
 * context; `getRandomValues` works on any page.
 */
const randomId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');

/** What a failed check means for the user. */
const errorStatus = (
  error: unknown
): Exclude<EditorStatus, {state: 'idle'}> => {
  const message = error instanceof Error ? error.message : String(error);
  if (!(error instanceof CheckHttpError)) return {state: 'error', message};
  if (error.status === 401 || error.status === 403) {
    return {state: 'unauthorized'};
  }
  // An API version or client version the API no longer supports.
  if (error.status === 400) {
    return {state: 'outdated', message: error.detail ?? message};
  }
  // Validation errors are 422s too; only this one is about the text.
  if (error.status === 422 && error.types.includes(LANGUAGE_NOT_SUPPORTED)) {
    return {state: 'unsupportedLanguage'};
  }
  return {state: 'error', message};
};

/** Marks the switch's own edit, which must not clear its message. */
const SWITCH_META = 'wittyGenderFormatSwitch';

/**
 * Embeddable entry point: `WittyEditor.mount(element, options)`. The PoC shape
 * of the component API; the custom element (`<witty-editor>`) wraps this in
 * Phase 3.
 */

// The package's public types; see api.ts.
export type {
  CheckConfig,
  CheckLang,
  CheckVariant,
  EditorSettings,
  EditorStatus,
  GenderFormatSwitchResult,
  Mount,
  MountOptions,
  SwitchOutcome,
  WittyEditorHandle,
} from './api';

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

export const mount: Mount = (
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
    installationId = randomId(),
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
  // What the switch's own check responses said; collected while it runs.
  let switchInfo: SwitchCheckInfo | null = null;
  // Whether the API has bulk actions: every response of one that has says so
  // (`bulk_actions`); a switch can also find an API that predates them.
  let bulkSupport: 'unknown' | 'yes' | 'no' = 'unknown';
  // Targets a switch found the API cannot convert to yet (`bulk_actions`
  // without "gender_format" for French or the Inklusivum).
  const unsupportedTargets = new Set<string>();
  // Both are read per request, so `setApiKey` and settings changes reach the
  // next check without rebuilding the checker.
  const httpCheck = createHttpChecker({
    endpoint,
    headers,
    lang,
    id: installationId,
    config: requestConfig,
  });
  const check: Checker = async (text, signal) => {
    const info = switchInfo;
    const response = await httpCheck(text, signal);
    if (
      response.bulk_actions ||
      response.results?.some((result) => result.bulk === GENDER_FORMAT_BULK)
    ) {
      bulkSupport = 'yes';
    }
    info?.responses.push({
      language: response.language,
      separator: response.gender_separator,
      bulkActions: response.bulk_actions,
    });
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
          const next = errorStatus(error);
          // The API refused the text as such: the last alerts no longer
          // stand. Anything else (unreachable, a server error) is likely
          // passing, so they stay until the next check.
          if (next.state !== 'error') clearAlerts(editor.view);
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

  /**
   * The languages whose formats "Switch gender format…" offers: the host's
   * `lang` if it fixed German or French, otherwise German and French as far as
   * the API found them in the text, most of the text first. A text in neither
   * (or not checked yet) gets both.
   */
  const switchLanguages = (): SwitchLanguage[] => {
    const fixed = lang.slice(0, 2);
    if (fixed === 'de' || fixed === 'fr') return [fixed];
    const found = getTextLanguages(editor.state);
    const present = (['de', 'fr'] as const)
      .filter((language) => found[language])
      .sort((a, b) => found[b] - found[a]);
    return present.length ? present : ['de', 'fr'];
  };

  const runSwitch = async (
    target: string
  ): Promise<GenderFormatSwitchResult> => {
    const language = formatLanguage(target);
    if (!language) {
      return {outcome: 'unavailable', target, count: 0, limitReached: false};
    }

    // 1. The target becomes the configured format of its language (the
    //    toolbar shows it; the other language's stays), and the switch's
    //    checks ask for the gender-format alerts regardless of the user's
    //    category settings, which stay as they are.
    const field = FORMAT_FIELD[language];
    const previousConfig = settings.get().config;
    const userConfig: CheckConfig = {...previousConfig, [field]: target};
    switchConfig = switchRequestConfig(userConfig, target, language).config;
    const info: SwitchCheckInfo = {responses: []};
    switchInfo = info;
    const checked = nextCompleteCheck();
    settings.set({config: userConfig});
    // Also clears the sentence cache: only fresh responses say which format
    // the API applied.
    requestRecheck(editor.view);

    let limitReached: boolean;
    try {
      // 2. Every batch of the text, not only the first.
      limitReached = await checked;
    } finally {
      switchConfig = null;
      switchInfo = null;
    }

    // 3. All bulk alerts in one transaction: one undo restores the text. Not
    //    when the account forces another format: they would convert to that.
    const decision = decideSwitch(
      info,
      target,
      editor.state.doc.textContent,
      getAlerts(editor.state),
      {language, previous: previousConfig[field]}
    );
    let result: GenderFormatSwitchResult;
    if (decision.outcome === 'switched') {
      editor.view.dispatch(
        applyEdits(editor.state, decision.apply).setMeta(SWITCH_META, true)
      );
      result = {
        outcome: 'switched',
        target,
        count: decision.apply.length,
        limitReached,
      };
    } else if (decision.outcome === 'forced') {
      // The setting would not take effect either.
      settings.set({config: previousConfig});
      result = {
        outcome: 'forced',
        target,
        count: 0,
        limitReached,
        applied: decision.applied,
      };
    } else {
      if (decision.outcome === 'unsupported') {
        // An API without bulk actions at all, or one that cannot switch to
        // this target yet: then the other targets it can't either.
        const knowsBulkActions = info.responses.some(
          ({bulkActions}) => bulkActions
        );
        if (!knowsBulkActions && language === 'de') bulkSupport = 'no';
        const targets =
          language === 'fr' ? SWITCHABLE_FORMATS.fr : [INKLUSIVUM];
        if (knowsBulkActions || language === 'fr') {
          targets.forEach((format) => unsupportedTargets.add(format));
        }
      }
      result = {outcome: decision.outcome, target, count: 0, limitReached};
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

  // Changes the user makes (the settings panel) or asks for through the host
  // (updateSettings); either way, tell the host.
  const changeSettings = (next: Partial<EditorSettings>): void => {
    settings.set(next);
    onSettingsChange?.(settings.get());
  };

  const toolbarHandle = toolbar
    ? mountToolbar(toolbarHost, {
        editor,
        store: {...settings, set: changeSettings},
        status,
        loadOptions,
        onSwitch: async (target) => {
          const result = await switchGenderFormat(target);
          // Chosen in the menu: the gender format setting is the user's.
          onSettingsChange?.(settings.get());
          return result;
        },
        switchSupported: (target?: string): boolean =>
          bulkSupport !== 'no' && !(target && unsupportedTargets.has(target)),
        switchLanguages,
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
    updateSettings(next: Partial<EditorSettings>): void {
      // Hosts in plain JavaScript bypass the types: a string "false" would
      // read as true and switch LLM requests on. Refuse, changing nothing.
      for (const field of ['llmAlternatives', 'orthography'] as const) {
        if (next[field] !== undefined && typeof next[field] !== 'boolean') {
          throw new TypeError(`updateSettings: ${field} must be a boolean`);
        }
      }
      if (
        next.config !== undefined &&
        (typeof next.config !== 'object' ||
          next.config === null ||
          Array.isArray(next.config))
      ) {
        throw new TypeError('updateSettings: config must be an object');
      }
      const current = settings.get();
      const changed: Partial<EditorSettings> = {};
      if (
        next.llmAlternatives !== undefined &&
        next.llmAlternatives !== current.llmAlternatives
      ) {
        changed.llmAlternatives = next.llmAlternatives;
      }
      if (
        next.orthography !== undefined &&
        next.orthography !== current.orthography
      ) {
        changed.orthography = next.orthography;
      }
      // A copy: the host keeps its object, the editor its settings.
      if (
        next.config !== undefined &&
        JSON.stringify(next.config) !== JSON.stringify(current.config)
      ) {
        changed.config = structuredClone(next.config);
      }
      // Nothing new: no check, no onSettingsChange.
      if (!Object.keys(changed).length) return;
      // The store's subscriber checks again for a new config, drops the
      // rewrites already fetched, and flips the browser spellcheck.
      changeSettings(changed);
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
