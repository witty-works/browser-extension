import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import {CheckHttpError, createHttpChecker} from './checkClient';
import {
  checkPluginKey,
  getAlerts,
  requestRecheck,
  WittyCheck,
} from './checkPlugin';

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
  /** Initial content (HTML). */
  content?: string;
  /** Accessible name of the editable area. */
  label?: string;
  /** Debounce after the last edit, in ms. */
  delay?: number;
  onStatus?: (status: EditorStatus) => void;
}

export interface WittyEditorHandle {
  editor: Editor;
  /** Replace the API key (empty string clears it) and check again. */
  setApiKey(key: string): void;
  /** Plain text of the document. */
  getText(): string;
  destroy(): void;
}

/** Underline colours from the extension's getColor (hover shade). */
const STYLES = `
.witty-editor .ProseMirror { outline: none; min-height: 8rem; }
.witty-alert {
  text-decoration: underline wavy;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  text-decoration-skip-ink: none;
}
.witty-alert--severe { text-decoration-color: #e6635a; }
.witty-alert--bias { text-decoration-color: #eb9f46; }
.witty-alert--style { text-decoration-color: #f6ec6b; }
.witty-alert--inclusive { text-decoration-color: #bcd485; }
.witty-alert--corporate { text-decoration-color: #6f9fed; }
`;

const STYLE_ID = 'witty-editor-styles';

const injectStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.append(style);
};

export const mount = (
  element: HTMLElement,
  {
    endpoint = `${location.origin}/`,
    apiKey = '',
    content = '',
    label = 'Text to check',
    delay = 500,
    onStatus,
  }: MountOptions = {}
): WittyEditorHandle => {
  injectStyles();
  element.classList.add('witty-editor');

  let key = apiKey;
  const check = createHttpChecker({
    endpoint,
    headers: (): Record<string, string> => (key ? {'x-key': key} : {}),
  });

  const editor = new Editor({
    element,
    extensions: [
      StarterKit,
      WittyCheck.configure({
        check,
        delay,
        onError: (error) =>
          onStatus?.(
            error instanceof CheckHttpError &&
              (error.status === 401 || error.status === 403)
              ? {state: 'unauthorized'}
              : {state: 'error', message: String(error)}
          ),
      }),
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
      // Report when results land or an edit may have removed highlights.
      if (
        transaction.docChanged ||
        transaction.getMeta(checkPluginKey)?.type === 'results'
      ) {
        onStatus?.({state: 'idle', alerts: getAlerts(current.state).length});
      }
    },
  });

  return {
    editor,
    setApiKey(next: string): void {
      key = next;
      requestRecheck(editor.view);
    },
    getText: (): string => editor.getText(),
    destroy: (): void => editor.destroy(),
  };
};
