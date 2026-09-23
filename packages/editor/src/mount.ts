import {Editor, Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Plugin} from '@tiptap/pm/state';

import {highlightColors} from '@witty/core/constants';
import {initI18n} from '@witty/i18n/i18n';
import {
  credentialHeaders,
  LLM_SUGGESTION_TIMEOUT_MS,
} from '@witty/core/ApiServices/requests';
import {
  type CheckConfig,
  CheckHttpError,
  type CheckLang,
  createHttpChecker,
} from './checkClient';
import {
  checkPluginKey,
  getAlerts,
  requestRecheck,
  WittyCheck,
} from './checkPlugin';
import {PopoverHost} from './popover';
import {createSettingsStore, type EditorSettings} from './settings';
import {mountToolbar, TOOLBAR_STYLES} from './toolbar';

/**
 * Embeddable entry point: `WittyEditor.mount(element, options)`. The PoC shape
 * of the component API; the custom element (`<witty-editor>`) wraps this in
 * Phase 3.
 */

export type EditorStatus =
  | {state: 'idle'; alerts: number}
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
  destroy(): void;
}

export type {CheckConfig, CheckLang, CheckVariant} from './checkClient';
export type {EditorSettings} from './settings';

/**
 * Highlights in the extension's look, with its colours: a 2px line in the
 * group colour (dotted for orthography) and, while the popover is open, the
 * rounded fill at 20% opacity.
 */
const buildStyles = (): string =>
  [
    '.witty-editor .ProseMirror { outline: none; min-height: 8rem; }',
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
  // Both are read per request, so `setApiKey` and settings changes reach the
  // next check without rebuilding the checker.
  const check = createHttpChecker({
    endpoint,
    headers,
    lang,
    config: (): CheckConfig => settings.get().config,
  });

  const editableAttributes = (): Record<string, string> => {
    return {
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': label,
      // Witty checks spelling; two sets of underlines would compete.
      spellcheck: settings.get().orthography ? 'false' : 'true',
    };
  };

  // Toolbar first, then the editable; both inside the host's element.
  const toolbarHost = document.createElement('div');
  const editorHost = document.createElement('div');
  element.append(...(toolbar ? [toolbarHost] : []), editorHost);
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
        isIgnored: (alert) => ignored.has(alert.data.text),
        onError: (error) =>
          onStatus?.(
            error instanceof CheckHttpError &&
              (error.status === 401 || error.status === 403)
              ? {state: 'unauthorized'}
              : {
                  state: 'error',
                  message:
                    error instanceof Error ? error.message : String(error),
                }
          ),
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
      const meta = transaction.getMeta(checkPluginKey)?.type;
      if (transaction.docChanged || meta === 'results' || meta === 'dismiss') {
        onStatus?.({state: 'idle', alerts: getAlerts(current.state).length});
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
        api: {endpoint, headers},
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
    destroy: (): void => {
      unsubscribe();
      toolbarHandle?.destroy();
      popover.destroy();
      editor.destroy();
      toolbarHost.remove();
      editorHost.remove();
    },
  };
};
