import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import {extractText} from './textMap';

const extracted = document.querySelector<HTMLElement>('#extracted')!;

const showExtracted = (editor: Editor): void => {
  // Separators made visible, so block boundaries can be checked by eye.
  extracted.textContent = extractText(editor.state.doc).text.replace(
    /\n/g,
    '⏎\n'
  );
};

const editor = new Editor({
  element: document.querySelector<HTMLElement>('#editor')!,
  extensions: [StarterKit],
  content:
    '<p>Hey guys, the chairman will assume the leadership role.</p>' +
    '<ul><li><p>First point</p></li><li><p>Second point</p></li></ul>' +
    '<p>Run <code>guysFn()</code> first.</p>',
  onCreate: ({editor: created}): void => showExtracted(created),
  onUpdate: ({editor: updated}): void => showExtracted(updated),
});

export default editor;
