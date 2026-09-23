import {describe, expect, it} from 'vitest';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type {Node as PMNode} from '@tiptap/pm/model';
import {EditorState} from '@tiptap/pm/state';

import type {IAlert} from '@witty/core/types';
import type {Alert} from './checkPlugin';
import {resolveReplacement} from './replacement';
import {extractText, textRangeToDoc} from './textMap';

const schema = getSchema([StarterKit]);

const paragraph = (...content: object[]) => {
  return {type: 'paragraph', content};
};
const text = (value: string, marks?: {type: string}[]) => {
  return {
    type: 'text',
    text: value,
    ...(marks ? {marks} : {}),
  };
};
const doc = (...content: object[]): PMNode =>
  schema.nodeFromJSON({type: 'doc', content});

/**
 * An alert on `word` as the check would have produced it for `checked`, whose
 * sentence is the whole of `sentence`.
 */
const alertFor = (checked: PMNode, word: string, sentence: string): Alert => {
  const map = extractText(checked);
  const start = map.text.indexOf(word);
  const range = textRangeToDoc(map, start, start + word.length)!;
  const sentenceStart = map.text.indexOf(sentence);
  return {
    id: 'a',
    ...range,
    detail: {
      absOffset: start,
      data: {
        text: word,
        fullSentence: {
          raw: sentence,
          range: [sentenceStart, sentenceStart + sentence.length],
        },
      },
    } as unknown as IAlert,
  };
};

/** Apply as the popover does: one transaction on the current document. */
const apply = (node: PMNode, alert: Alert, chosen: string, llm?: object) => {
  const {
    from,
    to,
    text: replacement,
  } = resolveReplacement(
    node,
    alert,
    chosen,
    llm ? new Map(Object.entries(llm)) : null
  );
  const {tr} = EditorState.create({doc: node});
  return (
    replacement ? tr.insertText(replacement, from, to) : tr.delete(from, to)
  ).doc.textContent;
};

describe('resolveReplacement', () => {
  const node = doc(paragraph(text('The chairman is here. Hey guys.')));

  it('replaces the flagged text with a plain alternative', () => {
    const alert = alertFor(node, 'chairman', 'The chairman is here.');
    expect(apply(node, alert, 'chair')).toBe('The chair is here. Hey guys.');
  });

  it('replaces the whole sentence with an LLM rewrite', () => {
    const alert = alertFor(node, 'chairman', 'The chairman is here.');
    expect(apply(node, alert, 'they', {they: 'They are here.'})).toBe(
      'They are here. Hey guys.'
    );
  });

  it('falls back to the plain alternative once the sentence was edited', () => {
    const alert = alertFor(node, 'chairman', 'The chairman is here.');
    // The check saw "is here"; the document now says "was here".
    const edited = doc(paragraph(text('The chairman was here. Hey guys.')));

    expect(apply(edited, alert, 'they', {they: 'They are here.'})).toBe(
      'The they was here. Hey guys.'
    );
  });

  it('falls back when the sentence spans text the checker did not see', () => {
    const withCode = doc(
      paragraph(
        text('The chairman runs '),
        text('deploy()', [{type: 'code'}]),
        text(' daily.')
      )
    );
    const alert = alertFor(withCode, 'chairman', 'The chairman runs ￼ daily.');

    expect(
      apply(withCode, alert, 'chair', {chair: 'The chair runs it daily.'})
    ).toBe('The chair runs deploy() daily.');
  });

  it('removes the flagged text with the space before it', () => {
    const alert = alertFor(node, 'guys', 'Hey guys.');
    expect(apply(node, alert, ' ')).toBe('The chairman is here. Hey.');
  });

  it('turns ((placeholders)) into brackets, as the extension does', () => {
    const alert = alertFor(node, 'chairman', 'The chairman is here.');
    expect(apply(node, alert, '((name))')).toBe(
      'The [name] is here. Hey guys.'
    );
  });
});
