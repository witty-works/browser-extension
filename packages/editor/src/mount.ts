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
  isLimitReached,
  requestRecheck,
  WittyCheck,
} from './checkPlugin';
import type {EditorStatus, Mount, MountOptions, WittyEditorHandle} from './api';
import {createCheckWaiters} from './checkWaiters';
import {PopoverHost} from './popover';
import {
  type CheckStatus,
  createSettingsStore,
  createStore,
  type EditorSettings,
} from './settings';
import {
  createSwitchController,
  SWITCH_META,
  type SwitchController,
} from './switchController';
import {createOptionsLoader, mountToolbar, TOOLBAR_STYLES} from './toolbar';

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
  // Set once the editor exists: the gender format switch, whose checks use
  // their own config while it runs.
  const switcherRef: {current?: SwitchController} = {};
  const requestConfig = (): CheckConfig =>
    switcherRef.current?.requestConfig() ?? settings.get().config;
  let destroyed = false;
  // Callers waiting for the next complete check (the switch).
  const waiters = createCheckWaiters();
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
    const record = switcherRef.current?.request();
    const response = await httpCheck(text, signal);
    record?.(response);
    return response;
  };

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
          waiters.failed(error);
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
        waiters.started();
      }
      if (meta?.type === 'results' && meta.complete !== false) {
        waiters.completed(isLimitReached(current.state));
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

  const switchController = createSwitchController({
    editor,
    settings,
    status,
    waiters,
    loadOptions,
    t,
    lang,
    onStatus,
    destroyed: (): boolean => destroyed,
  });
  switcherRef.current = switchController;
  const {switchGenderFormat} = switchController;

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
        switchSupported: switchController.supported,
        switchLanguages: switchController.languages,
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
      // Replaces, never merges; the store's subscriber re-checks. The same
      // config again changes nothing, so a host may pass it on every render.
      if (JSON.stringify(next) === JSON.stringify(settings.get().config)) {
        return;
      }
      settings.set({config: structuredClone(next)});
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
      destroyed = true;
      // A switch waiting for its check ends with an error, not never.
      waiters.destroy();
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
