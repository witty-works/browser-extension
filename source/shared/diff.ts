import {diffWords, DiffWordsOptionsNonabortable} from 'diff';

import {DiffChange} from './types';

export const removeHTMLTags = (htmlString: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const textContent = doc.body.textContent ?? '';
  return textContent.trim();
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * The sentence comes from the user's document and the rewrite from an LLM;
 * neither is markup. The diff is rendered as HTML, so every piece of text is
 * escaped before it is wrapped in <ins>/<del>.
 */
const escapeHtml = (text: string): string =>
  // The pattern matches only keys of HTML_ESCAPES, so the fallback never applies.
  text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/**
 * HTML for the words `newSentence` changes in `originalSentence`: insertions in
 * <ins>, deletions in <del>, with up to 50 characters of context either side.
 * All text in it is escaped, so it is safe to render as HTML.
 */
export const computeDiff = (
  language: string,
  originalSentence: string,
  newSentence: string
) => {
  // diff v9 renamed WordsOptions and split the overloads: the non-abortable
  // one is what returns a definite array rather than `… | undefined`.
  const options: DiffWordsOptionsNonabortable = {
    intlSegmenter: new (Intl as any).Segmenter(language, {
      granularity: 'word',
    }),
  };

  const diffElements: DiffChange[] = diffWords(
    originalSentence,
    newSentence,
    options
  );

  const maxDiffLength = 120;
  const minDiffLength = 50;

  let diff = '';
  let tag = '';

  let start = 0;
  let end: number = diffElements.length - 1;

  for (const [i, diffElement] of diffElements.entries()) {
    if (diffElement.added || diffElement.removed) {
      if (diff === '') {
        start = i;
      } else if (diff.endsWith('</ins>') || diff.endsWith('</del>')) {
        diff += ' ';
      }
      end = i;

      tag = diffElement.added ? 'ins' : 'del';
      if (diffElement.value !== 'undefined') {
        diff += `<${tag}>${escapeHtml(diffElement.value)}</${tag}>`;
      }
    } else if (diff !== '' && i < diffElements.length - 1) {
      diff += escapeHtml(diffElement.value);
    }
  }

  const strippedString = removeHTMLTags(diff);
  let stringLengthDiff = maxDiffLength - strippedString.length;
  if (stringLengthDiff > 0) {
    let value = '';
    const firstElement = diffElements[0];
    if (start > 0 && firstElement) {
      value = firstElement.value.substring(
        Math.max(
          0,
          firstElement.value.length - Math.min(minDiffLength, stringLengthDiff)
        ),
        firstElement.value.length
      );

      if (value != firstElement.value) {
        value = value.slice(value.indexOf(' '));
        value = '...' + value;
      }

      diff = escapeHtml(value) + diff;
    }

    stringLengthDiff -= value.length;
    const lastElement = diffElements[diffElements.length - 1];
    if (end < diffElements.length - 1 && stringLengthDiff && lastElement) {
      let value = lastElement.value.substring(
        0,
        Math.min(minDiffLength, stringLengthDiff)
      );
      if (value != lastElement.value) {
        value = value.substring(0, value.lastIndexOf(' '));
        value = value + '...';
      }

      diff = diff + escapeHtml(value);
    }
  }

  return diff;
};
