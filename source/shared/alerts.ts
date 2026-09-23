/**
 * Alert helpers shared by the extension and the editor component. Free of
 * extension APIs and of the DOM.
 */

// Extract TxtSentenceNode from a generic node
export function extractSentenceNode(node: any): any {
  if (node.type === 'Sentence') return node;
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.find(
      (child: {type?: string}) => child.type === 'Sentence'
    );
  }
  return undefined;
}

export const generateAlertId = (
  text: string,
  category: string,
  startOffset: number,
  endOffset: number
) => `${text}-${category}-${startOffset}-${endOffset}`;

/** The alternative the popover offers for "remove the flagged text". */
export const REMOVE_ALTERNATIVE = ' ';

export interface ResolvedAlternative {
  /** Replacement text. */
  text: string;
  /**
   * What it replaces: the flagged text, or — for an LLM rewrite — the whole
   * sentence around it.
   */
  scope: 'alert' | 'sentence';
}

/**
 * What applying `alternative` means: the removal marker deletes the flagged
 * text, `((…))` placeholders become `[…]`, and when the LLM rewrote the
 * sentence for this alternative the rewrite replaces the whole sentence.
 */
export const resolveAlternative = (
  alternative: string,
  llmResults?: Map<string, string> | null
): ResolvedAlternative => {
  if (alternative === REMOVE_ALTERNATIVE) {
    return {text: '', scope: 'alert'};
  }

  const text = alternative.replace(/\(\(/g, '[').replace(/\)\)/g, ']');
  const rewrite = llmResults?.get(text);

  return rewrite ? {text: rewrite, scope: 'sentence'} : {text, scope: 'alert'};
};
