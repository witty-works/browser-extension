import type {ICachedSentenceAlerts} from './useSentenceCache';
import {IAlert, ICheckResponse} from '../types';
import {generateAlertId, extractSentenceNode} from '../utils';
import {SentenceSplitterSyntax, split} from 'sentence-splitter';
import {TxtNodeRange} from '@textlint/ast-node-types';

export interface CheckEndpointCachedResponse {
  alerts: IAlert[];
  checkEndpointResponse: ICheckResponse | undefined;
}

// Combines the sentence cache's hits with the (still in-flight) endpoint
// response into the shape callers render, sorted back into reading order.
export const buildCachedResponse = (
  cachedAlerts: IAlert[],
  checkEndpointResponse?: ICheckResponse
): CheckEndpointCachedResponse => {
  return {
    alerts: [...cachedAlerts].sort((firstAlert, secondAlert) =>
      firstAlert.startOffset < secondAlert.startOffset ? -1 : 1
    ),
    checkEndpointResponse,
  };
};

// Shifts every alert at or after `changedOffset` by the length delta of a
// local edit, so highlights stay put between a keystroke and the next
// check response.
export const adjustAlertPositions = (
  alerts: IAlert[],
  changedOffset: number,
  originalLength: number,
  newLength: number
): IAlert[] =>
  alerts.map((alert) => {
    if (alert.startOffset >= changedOffset) {
      const newStartOffset = alert.startOffset + newLength - originalLength;
      const newEndOffset = alert.endOffset + newLength - originalLength;
      return {
        ...alert,
        id: generateAlertId(
          alert.data.text,
          alert.data.category,
          newStartOffset,
          newEndOffset
        ),
        startOffset: newStartOffset,
        endOffset: newEndOffset,
        data: {
          ...alert.data,
          fullSentence: {
            ...alert.data.fullSentence,
            range: [
              alert.data.fullSentence.range[0],
              alert.data.fullSentence.range[1] + newLength - originalLength,
            ] as TxtNodeRange,
          },
        },
      };
    }

    return alert;
  });

// Turns a check-endpoint response back into per-sentence alert buckets so
// they can be written into the sentence cache, keyed by the text that was
// actually sent to the endpoint.
export const buildSentenceAlertsFromResponse = (
  checkEndpointResponse: ICheckResponse,
  lastCheckedText: string
): ICachedSentenceAlerts[] => {
  const {results} = checkEndpointResponse;
  const lastCheckedTextSentences = split(lastCheckedText).filter(
    (s) => s.type === SentenceSplitterSyntax.Sentence
  );
  const sentencesAlerts: ICachedSentenceAlerts[] = [];

  lastCheckedTextSentences.forEach((sentence) => {
    const sentenceStartOffset = sentence.range[0];
    const sentenceEndOffset = sentence.range[1];
    const alerts: IAlert[] = [];

    results.forEach((result) => {
      if (
        result.start >= sentenceStartOffset &&
        result.end <= sentenceEndOffset
      ) {
        const adjustedStart = result.start - sentence.range[0];
        const adjustedEnd = result.end - sentence.range[0];

        // Use shared utility to extract TxtSentenceNode
        const sentenceNode = extractSentenceNode(sentence);
        if (sentenceNode) {
          alerts.push({
            id: generateAlertId(
              result.text,
              result.category,
              result.start,
              result.end
            ),
            startOffset: adjustedStart,
            absOffset: result.start,
            endOffset: adjustedEnd,
            popOverIsOpen: false,
            data: {
              language: checkEndpointResponse.language,
              gender_separator: checkEndpointResponse.gender_separator,
              category: result.category,
              subcategory: result.subcategory,
              context: result.context,
              fullSentence: sentenceNode,
              text: result.text,
              text_id: result.text_id,
              label: result.label,
              explanation: result.explanation,
              alternatives: result.alternatives,
              gravity: result.gravity,
              limit_reached: result.limit_reached,
              source: result.source,
            },
          });
        }
      }
    });

    sentencesAlerts.push({
      sentence: sentence.raw,
      alerts,
    });
  });

  return sentencesAlerts;
};
