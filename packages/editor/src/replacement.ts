import type {Node as PMNode} from '@tiptap/pm/model';

import {
  REMOVE_ALTERNATIVE,
  resolveAlternative,
} from '../../../source/shared/alerts';
import type {Alert} from './checkPlugin';

export interface Replacement {
  from: number;
  to: number;
  /** Empty for a removal. */
  text: string;
}

/**
 * What applying `chosen` to `alert` changes in `doc`, with the extension's
 * rules (`resolveAlternative`): the flagged text, or — for an LLM rewrite —
 * the whole sentence around it.
 *
 * The sentence is replaced only while the document still holds it exactly as
 * it was checked, as one run of text; after an edit to it, or when it spans
 * something the checker did not see (inline code, a mention), the plain
 * alternative replaces the flagged text instead. Removing a word takes the
 * space before it along, as in the extension.
 */
export const resolveReplacement = (
  doc: PMNode,
  alert: Alert,
  chosen: string,
  llmResults?: Map<string, string> | null
): Replacement => {
  let resolved = resolveAlternative(chosen, llmResults);
  let {from, to} = alert;

  if (resolved.scope === 'sentence') {
    const {detail} = alert;
    const sentence = detail.data.fullSentence;
    const sentenceFrom = alert.from - (detail.absOffset - sentence.range[0]);
    const sentenceTo = sentenceFrom + sentence.raw.length;
    if (
      sentenceFrom >= 0 &&
      sentenceTo <= doc.content.size &&
      doc.textBetween(sentenceFrom, sentenceTo) === sentence.raw
    ) {
      from = sentenceFrom;
      to = sentenceTo;
    } else {
      resolved = resolveAlternative(chosen, null);
    }
  }

  if (
    chosen === REMOVE_ALTERNATIVE &&
    from > 0 &&
    doc.textBetween(from - 1, from) === ' '
  ) {
    from -= 1;
  }

  return {from, to, text: resolved.text};
};
