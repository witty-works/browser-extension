import {describe, expect, it} from 'vitest';

import type {ICheckResponseResult} from './checkClient';
import {
  CheckBudget,
  planBatch,
  resultsBySentence,
  SentenceCache,
  splitSentences,
} from './sentenceCheck';

const texts = (text: string) => splitSentences(text).map((s) => s.text);

describe('splitSentences', () => {
  it('splits sentences with their offsets', () => {
    const text = 'Hey guys. The chairman is here!';
    const sentences = splitSentences(text);

    expect(sentences.map((s) => s.text)).toEqual([
      'Hey guys.',
      'The chairman is here!',
    ]);
    for (const s of sentences) expect(text.slice(s.start, s.end)).toBe(s.text);
  });

  it('never runs an unpunctuated block into the next one', () => {
    expect(texts('First point\n\nRun it first.')).toEqual([
      'First point',
      'Run it first.',
    ]);
  });

  it('returns nothing for an empty text', () => {
    expect(splitSentences('')).toEqual([]);
  });
});

describe('planBatch', () => {
  const text = 'One is here. Two is here. Three is here.';
  const sentences = splitSentences(text);

  it('sends neighbouring sentences as the original text', () => {
    const batch = planBatch(text, sentences, 1000)!;
    expect(batch.text).toBe(text);
    expect(batch.parts.map((p) => p.offset)).toEqual([0, 13, 26]);
  });

  it('joins sentences that are not neighbours with a blank line', () => {
    const batch = planBatch(text, [sentences[0], sentences[2]], 1000)!;
    expect(batch.text).toBe('One is here.\n\nThree is here.');
    expect(batch.parts.map((p) => p.offset)).toEqual([0, 14]);
  });

  it('stops before the budget', () => {
    const batch = planBatch(text, sentences, 26)!;
    expect(batch.text).toBe('One is here. Two is here.');
  });

  it('sends a sentence longer than the budget on its own', () => {
    const batch = planBatch(text, sentences, 5)!;
    expect(batch.text).toBe('One is here.');
  });

  it('has nothing to send when nothing is pending', () => {
    expect(planBatch(text, [], 1000)).toBeNull();
  });
});

describe('resultsBySentence', () => {
  const text = 'Hey guys.\n\nThe chairman is here.';
  const [first, second] = splitSentences(text);
  const batch = planBatch(text, [first, second], 1000)!;
  const result = (start: number, end: number) =>
    ({text: 'x', start, end}) as ICheckResponseResult;

  it('gives each sentence its results, relative to the sentence', () => {
    const bySentence = resultsBySentence(batch, [result(4, 8), result(15, 23)]);

    expect(bySentence.get(first)?.map((r) => [r.start, r.end])).toEqual([
      [4, 8],
    ]);
    expect(bySentence.get(second)?.map((r) => [r.start, r.end])).toEqual([
      [4, 12],
    ]);
  });

  it('drops a result that spans two sentences', () => {
    const bySentence = resultsBySentence(batch, [result(4, 15)]);
    expect([...bySentence.values()].flat()).toEqual([]);
  });
});

describe('SentenceCache', () => {
  const [sentence] = splitSentences('Hey guys.');

  it('forgets everything when the scope changes', () => {
    const cache = new SentenceCache();
    cache.useScope('a');
    cache.set(sentence, {results: [], partial: false});
    cache.useScope('a');
    expect(cache.get(sentence)).toBeDefined();

    cache.useScope('b');
    expect(cache.get(sentence)).toBeUndefined();
  });

  it('drops the least recently used entry past its capacity', () => {
    const cache = new SentenceCache(2);
    const [a, b, c] = splitSentences('One. Two. Three.');
    cache.set(a, {results: [], partial: false});
    cache.set(b, {results: [], partial: false});
    cache.get(a);
    cache.set(c, {results: [], partial: false});

    expect(cache.get(a)).toBeDefined();
    expect(cache.get(b)).toBeUndefined();
  });
});

describe('CheckBudget', () => {
  it('halves down to a floor', () => {
    const budget = new CheckBudget(300);
    expect(budget.shrink()).toBe(true);
    expect(budget.value).toBe(150);
    expect(budget.shrink()).toBe(true);
    expect(budget.value).toBe(CheckBudget.MINIMUM);
    expect(budget.shrink()).toBe(false);
  });
});
