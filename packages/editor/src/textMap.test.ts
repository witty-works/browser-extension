import {describe, expect, it} from 'vitest';
import {getSchema, Node} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type {Node as PMNode} from '@tiptap/pm/model';

import {
  docPosToText,
  extractText,
  textRangeToDoc,
  type TextMap,
} from './textMap';

// Stand-in for the mention node the schema will carry (decision 2): an inline
// atom whose label is not the user's prose.
const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => {
    return {label: {default: ''}};
  },
});

const schema = getSchema([StarterKit, Mention]);

type JSONNode = Record<string, unknown>;

const text = (value: string, marks?: {type: string}[]): JSONNode => {
  return {
    type: 'text',
    text: value,
    ...(marks ? {marks} : {}),
  };
};
const paragraph = (...content: JSONNode[]): JSONNode => {
  return {type: 'paragraph', content};
};
const doc = (...content: JSONNode[]): PMNode =>
  schema.nodeFromJSON({type: 'doc', content});

/** Every mapped character must be the same character in the document. */
const expectFaithful = (node: PMNode, map: TextMap): void => {
  for (let i = 0; i < map.text.length; i += 1) {
    const range = textRangeToDoc(map, i, i + 1);
    if (range) {
      expect(node.textBetween(range.from, range.to)).toBe(map.text[i]);
    }
  }
};

/** Document range of the first occurrence of `needle` in the extracted text. */
const rangeOf = (map: TextMap, needle: string): [number, number] => {
  const start = map.text.indexOf(needle);
  const range = textRangeToDoc(map, start, start + needle.length);
  if (!range) throw new Error(`"${needle}" does not map`);
  return [range.from, range.to];
};

describe('extractText', () => {
  it('separates textblocks so words never join across them', () => {
    const node = doc(paragraph(text('Hello')), paragraph(text('world')));
    const map = extractText(node);

    expect(map.text).toBe('Hello\n\nworld');
    expectFaithful(node, map);
  });

  it('separates headings, list items and blockquotes the same way', () => {
    const node = doc(
      {type: 'heading', attrs: {level: 1}, content: [text('Title')]},
      {
        type: 'bulletList',
        content: [
          {type: 'listItem', content: [paragraph(text('one'))]},
          {type: 'listItem', content: [paragraph(text('two'))]},
        ],
      },
      {type: 'blockquote', content: [paragraph(text('quoted'))]}
    );
    const map = extractText(node);

    expect(map.text).toBe('Title\n\none\n\ntwo\n\nquoted');
    expectFaithful(node, map);
  });

  it('merges differently marked text into one run', () => {
    const node = doc(
      paragraph(text('Hey '), text('guys', [{type: 'bold'}]), text(', hi'))
    );
    const map = extractText(node);

    expect(map.text).toBe('Hey guys, hi');
    expect(map.segments).toHaveLength(1);
    expect(node.textBetween(...rangeOf(map, 'guys'))).toBe('guys');
  });

  it('turns a hard break into an unmapped newline', () => {
    const node = doc(
      paragraph(text('line one'), {type: 'hardBreak'}, text('line two'))
    );
    const map = extractText(node);

    expect(map.text).toBe('line one\nline two');
    expect(textRangeToDoc(map, 8, 9)).toBeNull();
    expectFaithful(node, map);
  });

  it('replaces inline code with an unmapped placeholder', () => {
    const node = doc(
      paragraph(text('call '), text('guysFn()', [{type: 'code'}]), text(' now'))
    );
    const map = extractText(node);

    expect(map.text).toBe('call \uFFFC now');
    expect(map.text).not.toContain('guys');
    expectFaithful(node, map);
  });

  it('keeps words apart when inline code sits between them', () => {
    const node = doc(
      paragraph(text('foo'), text('x', [{type: 'code'}]), text('bar'))
    );

    expect(extractText(node).text).toBe('foo\uFFFCbar');
  });

  it('skips code blocks entirely', () => {
    const node = doc(
      paragraph(text('before')),
      {type: 'codeBlock', content: [text('const guys = 1;')]},
      paragraph(text('after'))
    );
    const map = extractText(node);

    expect(map.text).toBe('before\n\nafter');
    expectFaithful(node, map);
  });

  it('replaces inline atoms with an unmapped placeholder', () => {
    const node = doc(
      paragraph(
        text('ask'),
        {type: 'mention', attrs: {label: 'chairman'}},
        text('today')
      )
    );
    const map = extractText(node);

    expect(map.text).toBe('ask\uFFFCtoday');
    expectFaithful(node, map);
  });

  it('extracts an empty document as an empty string', () => {
    expect(extractText(doc(paragraph())).text).toBe('');
  });
});

describe('textRangeToDoc', () => {
  const node = doc(
    paragraph(text('Hey guys, the chairman')),
    paragraph(text('will assume'))
  );
  const map = extractText(node);

  it('maps a word in any block to the same word in the document', () => {
    expect(node.textBetween(...rangeOf(map, 'chairman'))).toBe('chairman');
    expect(node.textBetween(...rangeOf(map, 'assume'))).toBe('assume');
  });

  it('rejects a range that crosses a block boundary', () => {
    const start = map.text.indexOf('chairman');
    const end = map.text.indexOf('will') + 4;
    expect(textRangeToDoc(map, start, end)).toBeNull();
  });

  it('rejects empty, negative and out-of-bounds ranges', () => {
    expect(textRangeToDoc(map, 3, 3)).toBeNull();
    expect(textRangeToDoc(map, -1, 2)).toBeNull();
    expect(textRangeToDoc(map, 0, map.text.length + 1)).toBeNull();
  });
});

describe('docPosToText', () => {
  it('round-trips every mapped offset', () => {
    const node = doc(
      paragraph(text('one '), text('two', [{type: 'italic'}])),
      paragraph(text('three'))
    );
    const map = extractText(node);

    for (let i = 0; i < map.text.length; i += 1) {
      const range = textRangeToDoc(map, i, i + 1);
      if (range) expect(docPosToText(map, range.from)).toBe(i);
    }
  });

  it('returns null for a position outside any text', () => {
    const map = extractText(doc(paragraph(text('a')), paragraph(text('b'))));
    expect(docPosToText(map, 0)).toBeNull();
  });
});

describe('API offsets', () => {
  it('index the extracted text directly after an emoji', () => {
    const node = doc(paragraph(text('Thanks 🙏')), paragraph(text('Hey guys')));
    const map = extractText(node);

    // UTF-16 offsets, as the NLP API reports them: the emoji is two units, so
    // "guys" is at 15..19 (it would be 14..18 in code points).
    const range = textRangeToDoc(map, 15, 19);
    expect(range).not.toBeNull();
    expect(node.textBetween(range!.from, range!.to)).toBe('guys');
  });
});
