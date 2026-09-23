import {Editor, Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Plugin} from '@tiptap/pm/state';

import {highlightColors} from '../../../source/shared/constants';
import {initI18n} from '../../../source/i18n/i18n';
import {LLM_SUGGESTION_TIMEOUT_MS} from '../../../source/shared/ApiServices/requests';
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

/**
 * Highlights in the extension's look, with its colours: a 2px line in the
 * group colour (dotted for orthography) and, while the popover is open, the
 * rounded fill at 20% opacity.
 */
const buildStyles = (): string =>
  [
    '.witty-editor .ProseMirror { outline: none; min-height: 8rem; }',
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
  let checkConfig = config;
  const headers = (): Record<string, string> => (key ? {'x-key': key} : {});
  // Both are read per request, so `setApiKey` and `setConfig` reach the next
  // check without rebuilding the checker.
  const check = createHttpChecker({
    endpoint,
    headers,
    lang,
    config: (): CheckConfig | undefined => checkConfig,
  });
  const ignored = new Set<string>();
  // Created once the editor exists; its triggers only fire after that.
  const popoverRef: {current?: PopoverHost} = {};

  const editor = new Editor({
    element,
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
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
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
    llmAlternatives,
    llmTimeoutMs,
    ignored,
    config: (): CheckConfig | undefined => checkConfig,
  });
  popoverRef.current = popover;

  return {
    editor,
    setApiKey(next: string): void {
      key = next;
      popover.resetRewrites();
      requestRecheck(editor.view);
    },
    setConfig(next: CheckConfig): void {
      checkConfig = next;
      popover.resetRewrites();
      requestRecheck(editor.view);
    },
    getText: (): string => editor.getText(),
    destroy: (): void => {
      popover.destroy();
      editor.destroy();
    },
  };
};
