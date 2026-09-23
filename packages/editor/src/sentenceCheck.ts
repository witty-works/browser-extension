import {SentenceSplitterSyntax, split} from 'sentence-splitter';

import type {ICheckResponseResult} from './checkClient';

/**
 * Long texts, the way the browser extension checks them (its sentence cache,
 * useSentenceCache): split the text into sentences, send only the ones not yet
 * checked, cache the results per sentence, and repeat until every sentence is
 * done. A long document is checked progressively in requests the API accepts.
 *
 * One difference from the extension: the API checks at most TEXT_MAX_LENGTH
 * characters of a request and says so with `limit_reached`. The extension
 * cached every sentence it sent regardless, so sentences past the cut-off
 * counted as checked and clean. Here a batch that hit the limit is not cached;
 * it is sent again in smaller pieces (see `CheckBudget`).
 */

export interface Sentence {
  /** UTF-16 offsets into the extracted text. */
  start: number;
  end: number;
  text: string;
}

const BLOCK_SEPARATOR = /\n\n/g;

/**
 * Sentences of the extracted text. Blocks (paragraphs, list items, cells) are
 * split first: the sentence splitter would otherwise merge an unpunctuated
 * list item into the following paragraph.
 */
export const splitSentences = (text: string): Sentence[] => {
  const sentences: Sentence[] = [];
  let blockStart = 0;
  const blocks: [number, number][] = [];
  for (const match of text.matchAll(BLOCK_SEPARATOR)) {
    blocks.push([blockStart, match.index]);
    blockStart = match.index + match[0].length;
  }
  blocks.push([blockStart, text.length]);

  for (const [start, end] of blocks) {
    const block = text.slice(start, end);
    for (const node of split(block)) {
      if (node.type !== SentenceSplitterSyntax.Sentence) continue;
      sentences.push({
        start: start + node.range[0],
        end: start + node.range[1],
        text: node.raw,
      });
    }
  }
  return sentences;
};

export interface BatchPart {
  sentence: Sentence;
  /** Where the sentence sits in the batch text. */
  offset: number;
}

export interface Batch {
  text: string;
  parts: BatchPart[];
}

/**
 * The next request: unchecked sentences in document order, up to `budget`
 * characters. Neighbouring sentences are sent as the original text between
 * them, so the checker sees them in context; separate runs are joined by a
 * blank line. A single sentence longer than the budget goes alone.
 */
export const planBatch = (
  text: string,
  pending: Sentence[],
  budget: number
): Batch | null => {
  if (!pending.length) return null;

  let batchText = '';
  const parts: BatchPart[] = [];
  let runEnd = -1;

  for (const sentence of pending) {
    const adjacent =
      runEnd !== -1 && !/\S/.test(text.slice(runEnd, sentence.start));
    const joiner = !parts.length
      ? ''
      : adjacent
        ? text.slice(runEnd, sentence.start)
        : '\n\n';
    const added = joiner.length + sentence.text.length;
    if (parts.length && batchText.length + added > budget) break;

    batchText += joiner;
    parts.push({sentence, offset: batchText.length});
    batchText += sentence.text;
    runEnd = sentence.end;
  }

  return {text: batchText, parts};
};

/**
 * The response's results per sentence, with offsets relative to the sentence.
 * A result spanning two sentences belongs to neither and is dropped.
 */
export const resultsBySentence = (
  batch: Batch,
  results: ICheckResponseResult[]
): Map<Sentence, ICheckResponseResult[]> => {
  const bySentence = new Map<Sentence, ICheckResponseResult[]>(
    batch.parts.map((part) => [part.sentence, []])
  );
  for (const result of results) {
    const part = batch.parts.find(
      ({sentence, offset}) =>
        result.start >= offset && result.end <= offset + sentence.text.length
    );
    if (!part) continue;
    bySentence.get(part.sentence)?.push({
      ...result,
      start: result.start - part.offset,
      end: result.end - part.offset,
    });
  }
  return bySentence;
};

interface CachedSentence {
  results: ICheckResponseResult[];
  /** The API checked only the beginning (a sentence over its limit). */
  partial: boolean;
}

/**
 * Results per sentence text, for one scope: the same sentence can be flagged
 * differently under another config, language or account, so a scope change
 * empties the cache. Bounded, oldest entries first out.
 */
export class SentenceCache {
  private readonly entries = new Map<string, CachedSentence>();
  private scope = '';

  constructor(private readonly capacity = 5000) {}

  useScope(scope: string): void {
    if (scope === this.scope) return;
    this.scope = scope;
    this.entries.clear();
  }

  clear(): void {
    this.entries.clear();
  }

  get(sentence: Sentence): CachedSentence | undefined {
    const entry = this.entries.get(sentence.text);
    if (entry) {
      // Refresh its place in the eviction order.
      this.entries.delete(sentence.text);
      this.entries.set(sentence.text, entry);
    }
    return entry;
  }

  set(sentence: Sentence, entry: CachedSentence): void {
    this.entries.delete(sentence.text);
    this.entries.set(sentence.text, entry);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }
}

/**
 * How many characters to send per request. Starts at the API's default
 * TEXT_MAX_LENGTH; when a deployment's limit is lower, a multi-sentence batch
 * comes back with `limit_reached` and the budget halves until batches fit.
 */
export class CheckBudget {
  static readonly MINIMUM = 100;

  constructor(public value: number) {}

  /** Returns false when the batch cannot be made smaller. */
  shrink(): boolean {
    if (this.value <= CheckBudget.MINIMUM) return false;
    this.value = Math.max(CheckBudget.MINIMUM, Math.floor(this.value / 2));
    return true;
  }
}
