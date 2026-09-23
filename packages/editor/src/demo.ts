import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import {createHttpChecker} from './checkClient';
import {getAlerts, WittyCheck} from './checkPlugin';
import {extractText} from './textMap';

/**
 * PoC demo. `?api=` picks the NLP API; the default is a local one started with
 * REQUIRE_AUTH=false. `?api=http://localhost:5174/mock-api/` uses the e2e
 * suite's canned responses (start it with `node __tests__/fixtures/server.js`).
 */
const endpoint =
  new URLSearchParams(location.search).get('api') ?? 'http://localhost:8000/';

const extracted = document.querySelector<HTMLElement>('#extracted')!;
const status = document.querySelector<HTMLElement>('#status')!;
document.querySelector<HTMLElement>('#endpoint')!.textContent = endpoint;

const showState = (editor: Editor): void => {
  // Separators made visible, so block boundaries can be checked by eye.
  extracted.textContent = extractText(editor.state.doc).text.replace(
    /\n/g,
    '⏎\n'
  );
  const alerts = getAlerts(editor.state);
  status.textContent = `${alerts.length} alert${alerts.length === 1 ? '' : 's'}`;
};

const editor = new Editor({
  element: document.querySelector<HTMLElement>('#editor')!,
  extensions: [
    StarterKit,
    WittyCheck.configure({
      check: createHttpChecker({endpoint}),
      delay: 500,
      onError: (error) => {
        status.textContent = `check failed: ${String(error)}`;
      },
    }),
  ],
  content:
    '<p>Hey guys, the chairman will assume the leadership role.</p>' +
    '<ul><li><p>First point</p></li><li><p>Second point</p></li></ul>' +
    '<p>Run <code>guysFn()</code> first.</p>',
  onCreate: ({editor: created}): void => showState(created),
  onTransaction: ({editor: updated}): void => showState(updated),
});

export default editor;
