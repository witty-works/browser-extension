import type {Node as PMNode} from '@tiptap/pm/model';

/**
 * Plain-text extraction and the offset contract between the check API and the
 * ProseMirror document (EDITOR_COMPONENT_PLAN.md, "Text extraction and offset
 * mapping").
 *
 * The check API sees one plain string. Rules for building it:
 *
 * - Every textblock (paragraph, heading, list item paragraph, table cell
 *   paragraph) contributes its inline text, and consecutive textblocks are
 *   separated by `\n` — so words in adjacent blocks or cells never join into a
 *   phantom word the checker would flag.
 * - A hard break is `\n`.
 * - Content the checker must not see — code blocks, inline `code` marks and
 *   inline atom nodes (mentions, images) — is excluded. Excluded inline
 *   content leaves a single space so its neighbours stay separate words; code
 *   blocks are skipped whole.
 * - Separators and placeholders exist only in the string: they map to no
 *   document position, so an alert can never start or end on one.
 *
 * Offsets in `text` are UTF-16 indices (JavaScript string indices). The API
 * reports code-point offsets (spaCy's `token.idx`); convert with
 * `codePointIndexer` before resolving a range.
 */

/** A run of `text` that maps 1:1 onto document positions. */
interface Segment {
  textStart: number;
  textEnd: number;
  pos: number;
}

export interface TextMap {
  text: string;
  segments: Segment[];
}

const BLOCK_SEPARATOR = '\n';
const EXCLUDED_PLACEHOLDER = ' ';

const EXCLUDED_BLOCKS = new Set(['codeBlock']);
const EXCLUDED_MARKS = new Set(['code']);

export const extractText = (doc: PMNode): TextMap => {
  let text = '';
  const segments: Segment[] = [];
  let sawTextblock = false;

  const append = (chunk: string, pos: number | null): void => {
    if (!chunk) return;
    if (pos !== null) {
      const last = segments[segments.length - 1];
      // Adjacent text nodes with different marks are contiguous in both the
      // string and the document; merge them to keep lookups cheap.
      if (
        last &&
        last.textEnd === text.length &&
        last.pos + (last.textEnd - last.textStart) === pos
      ) {
        last.textEnd += chunk.length;
      } else {
        segments.push({
          textStart: text.length,
          textEnd: text.length + chunk.length,
          pos,
        });
      }
    }
    text += chunk;
  };

  doc.descendants((node, pos) => {
    if (EXCLUDED_BLOCKS.has(node.type.name)) {
      return false;
    }

    if (node.isTextblock) {
      if (sawTextblock) append(BLOCK_SEPARATOR, null);
      sawTextblock = true;
      return true;
    }

    if (node.isText) {
      if (node.marks.some((mark) => EXCLUDED_MARKS.has(mark.type.name))) {
        if (!text.endsWith(EXCLUDED_PLACEHOLDER))
          append(EXCLUDED_PLACEHOLDER, null);
      } else {
        append(node.text ?? '', pos);
      }
      return false;
    }

    if (node.type.name === 'hardBreak') {
      append(BLOCK_SEPARATOR, null);
      return false;
    }

    if (node.isInline && node.isAtom) {
      append(EXCLUDED_PLACEHOLDER, null);
      return false;
    }

    return true;
  });

  return {text, segments};
};

const findSegment = (map: TextMap, offset: number): Segment | undefined => {
  let low = 0;
  let high = map.segments.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = map.segments[mid];
    if (offset < segment.textStart) high = mid - 1;
    else if (offset >= segment.textEnd) low = mid + 1;
    else return segment;
  }
  return undefined;
};

/**
 * Document range for `text.slice(start, end)`, or `null` when the range does
 * not lie within a single mapped run (it touches a separator or excluded
 * content, or is out of bounds). Alerts are single words or short phrases
 * inside one textblock, so a range that crosses unmapped text is a stale or
 * nonsensical alert and is dropped rather than stretched.
 */
export const textRangeToDoc = (
  map: TextMap,
  start: number,
  end: number
): {from: number; to: number} | null => {
  if (start < 0 || end <= start || end > map.text.length) return null;

  const segment = findSegment(map, start);
  if (!segment || end > segment.textEnd) return null;

  return {
    from: segment.pos + (start - segment.textStart),
    to: segment.pos + (end - segment.textStart),
  };
};

/** Offset in `text` of document position `pos`, or `null` if it maps to none. */
export const docPosToText = (map: TextMap, pos: number): number | null => {
  for (const segment of map.segments) {
    const length = segment.textEnd - segment.textStart;
    if (pos >= segment.pos && pos <= segment.pos + length) {
      return segment.textStart + (pos - segment.pos);
    }
  }
  return null;
};

// A high surrogate starts every character outside the BMP.
const ASTRAL = /[\uD800-\uDBFF]/;

/**
 * Converter from the API's code-point offsets to UTF-16 indices in `text`;
 * returns `null` for an offset past the end. Characters outside the BMP (most
 * emoji) are one code point but two UTF-16 units, so the two drift apart after
 * the first such character. Built once per checked text: the common all-BMP
 * case is the identity.
 */
export const codePointIndexer = (
  text: string
): ((codePoints: number) => number | null) => {
  if (!ASTRAL.test(text)) {
    return (codePoints) =>
      codePoints >= 0 && codePoints <= text.length ? codePoints : null;
  }

  const indices: number[] = [];
  for (let index = 0; index < text.length;) {
    indices.push(index);
    index += (text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;
  }
  indices.push(text.length);

  return (codePoints) => indices[codePoints] ?? null;
};
