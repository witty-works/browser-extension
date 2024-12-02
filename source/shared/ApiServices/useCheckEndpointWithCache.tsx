import {useEffect, useRef, useState} from 'react';
import {ICachedSentenceAlerts, useSentenceCache} from './useSentenceCache';
import {IAlert, ICheckResponse} from "../types";
import {useCheckEndpoint} from "./useEndpoint";
import {generateAlertId} from "../utils";
import { split, Syntax } from '../../lib/sentence-splitter/sentence-splitter';

interface CheckEndpointCachedResponse {
  alerts: IAlert[];
  checkEndpointResponse: ICheckResponse | undefined;
}

export const useCheckEndpointWithCache = (onCheckResultsReceived: (result: ICheckResponse, checkedTextLength: number) => void) => {

  const { checkCache, addToCache } = useSentenceCache();
  const [cachedCheckEndpointResponse, setCachedCheckEndpointResponse] = useState<CheckEndpointCachedResponse | null>(null);
  const cachedCheckEndpointResponseRef = useRef<CheckEndpointCachedResponse | null>(null);
  const [checkEndpointResponse, checkEndpointError, setTextToCheck] = useCheckEndpoint();
  const lastCheckedTextRef = useRef<string | null>();
  const lastWholeTextRef = useRef<string | null>();

  const checkTextWithCache = (updatedText: string, checkEndpointResponse?: ICheckResponse) => {
    lastWholeTextRef.current = updatedText;
    const { cachedAlerts, nonCachedSentences: uncachedSentences } = checkCache(updatedText);

    if (uncachedSentences.length > 0) {
      const textToCheck = uncachedSentences.join(' ');
      lastCheckedTextRef.current = textToCheck;
      setTextToCheck(textToCheck);
    }

    const response = {
      alerts: [...cachedAlerts].sort((firstAlert, secondAlert) => {
        return firstAlert.startOffset < secondAlert.startOffset ? -1 : 1;
      }),
      checkEndpointResponse,
    };
    setCachedCheckEndpointResponse(response);
    cachedCheckEndpointResponseRef.current = response;
  };

  const adjustLocalAlertPositions = (changedOffset: number, originalLength: number, newLength: number) => {
    if (!cachedCheckEndpointResponseRef.current) {
      return;
    }

    const {alerts} = cachedCheckEndpointResponseRef.current
    const adjustedAlerts = alerts.map((alert) => {
      if (alert.startOffset >= changedOffset) {
        const newStartOffset = alert.startOffset + newLength - originalLength;
        const newEndOffset = alert.endOffset + newLength - originalLength;
        return {
          ...alert,
          id: generateAlertId(alert.data.text, alert.data.category, newStartOffset, newEndOffset),
          startOffset: newStartOffset,
          endOffset: newEndOffset,
        };
      }

      return alert;
    });

    const response = {
      alerts: adjustedAlerts,
      checkEndpointResponse: cachedCheckEndpointResponseRef.current.checkEndpointResponse,
    };
    setCachedCheckEndpointResponse(response);
    cachedCheckEndpointResponseRef.current = response;
  };

  useEffect(() => {
    if (!(checkEndpointResponse && lastCheckedTextRef.current)) {
      return;
    }

    const {results} = checkEndpointResponse;
    const lastCheckedTextSentences = split(lastCheckedTextRef.current).filter(s => s.type === Syntax.Sentence);
    const sentencesAlerts: ICachedSentenceAlerts[] = [];

    lastCheckedTextSentences.forEach(sentence => {
      const sentenceStartOffset = sentence.range[0];
      const sentenceEndOffset = sentence.range[1];
      const alerts: IAlert[] = [];

      onCheckResultsReceived(checkEndpointResponse, (lastCheckedTextRef.current && lastCheckedTextRef.current.length) || 0);

      results.forEach((result) => {
        if (result.start >= sentenceStartOffset && result.end <= sentenceEndOffset) {
          const adjustedStart = result.start - sentence.range[0];
          const adjustedEnd = result.end - sentence.range[0];

          alerts.push({
            id: generateAlertId(result.text, result.category, result.start, result.end),
            startOffset: adjustedStart,
            endOffset: adjustedEnd,
            popOverIsOpen: false,
            data: {
              language: checkEndpointResponse.language,
              category: result.category,
              subcategory: result.subcategory,
              context: result.context,
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
      });

      sentencesAlerts.push({
        sentence: sentence.raw,
        alerts
      });
    });
    addToCache(sentencesAlerts);
    lastWholeTextRef.current && checkTextWithCache(lastWholeTextRef.current, checkEndpointResponse);
  }, [checkEndpointResponse]);

  return [cachedCheckEndpointResponse, checkEndpointError, checkTextWithCache, adjustLocalAlertPositions] as const;
};
