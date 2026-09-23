import {diffWords, DiffWordsOptionsNonabortable} from 'diff';

import {DiffChange} from './types';

export const removeHTMLTags = (htmlString: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const textContent = doc.body.textContent ?? '';
  return textContent.trim();
};

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

  let diffElement: DiffChange;

  let diff = '';
  let tag = '';

  let start = 0;
  let end: number = diffElements.length - 1;

  for (let i = 0; i < diffElements.length; i++) {
    diffElement = diffElements[i];
    if (diffElement.added || diffElement.removed) {
      if (diff === '') {
        start = i;
      } else if (diff.endsWith('</ins>') || diff.endsWith('</del>')) {
        diff += ' ';
      }
      end = i;

      tag = diffElement.added ? 'ins' : 'del';
      if (diffElement.value !== 'undefined') {
        diff += `<${tag}>${diffElement.value}</${tag}>`;
      }
    } else if (diff !== '' && i < diffElements.length - 1) {
      diff += diffElement.value;
    }
  }

  const strippedString = removeHTMLTags(diff);
  let stringLengthDiff = maxDiffLength - strippedString.length;
  if (stringLengthDiff > 0) {
    let value = '';
    if (start > 0) {
      value = diffElements[0].value.substring(
        Math.max(
          0,
          diffElements[0].value.length -
            Math.min(minDiffLength, stringLengthDiff)
        ),
        diffElements[0].value.length
      );

      if (value != diffElements[0].value) {
        value = value.slice(value.indexOf(' '));
        value = '...' + value;
      }

      diff = value + diff;
    }

    stringLengthDiff -= value.length;
    if (end < diffElements.length - 1 && stringLengthDiff) {
      let value = diffElements[diffElements.length - 1].value.substring(
        0,
        Math.min(minDiffLength, stringLengthDiff)
      );
      if (value != diffElements[diffElements.length - 1].value) {
        value = value.substring(0, value.lastIndexOf(' '));
        value = value + '...';
      }

      diff = diff + value;
    }
  }

  return diff;
};
