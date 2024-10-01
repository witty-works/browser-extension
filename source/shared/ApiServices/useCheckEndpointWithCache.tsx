import {useEffect, useRef, useState} from 'react';
import {ICachedSentenceAlerts, useSentenceCache} from './useSentenceCache';
import {IAlert} from "../types";
import {useCheckEndpoint} from "./useEndpoint";
import {SentenceSplitterSyntax, split} from "sentence-splitter";

export const useCheckEndpointWithCache = () => {
  const { checkCache, addToCache } = useSentenceCache();
  const [alerts, setAlerts] = useState<IAlert[]>([]);  // Track alerts separately
  const [checkEndpointResponse, checkEndpointError, setTextToCheck] = useCheckEndpoint(); // The raw API response
  const lastCheckedTextRef = useRef<string | null>();
  const lastWholeTextRef = useRef<string | null>();

  const checkTextWithCache = (updatedText: string) => {
    lastWholeTextRef.current = updatedText;
    const { cachedAlerts, nonCachedSentences: uncachedSentences } = checkCache(updatedText);

    if (uncachedSentences.length > 0) {
      const textToCheck = uncachedSentences.join(' ');
      lastCheckedTextRef.current = textToCheck;
      setTextToCheck(textToCheck);
    }

    setAlerts(() => {
      return [...cachedAlerts].sort((firstAlert, secondAlert) => {
        return firstAlert.startOffset < secondAlert.startOffset ? -1 : 1;
      });
    });
  };

  useEffect(() => {
    if (!(checkEndpointResponse && lastCheckedTextRef.current)) {
      return;
    }

    const {results} = checkEndpointResponse;
    const lastCheckedTextSentences = split(lastCheckedTextRef.current).filter(s => s.type === SentenceSplitterSyntax.Sentence);
    const sentencesAlerts: ICachedSentenceAlerts[] = [];

    lastCheckedTextSentences.forEach(sentence => {
      const sentenceStartOffset = sentence.range[0];
      const sentenceEndOffset = sentence.range[1];
      const alerts: IAlert[] = [];

      results.forEach((result) => {
        if (result.start >= sentenceStartOffset && result.end <= sentenceEndOffset) {
          const adjustedStart = result.start - sentence.range[0];
          const adjustedEnd = result.end - sentence.range[0];

          alerts.push({
            id: `${result.text}-${result.category}-${result.start}${result.end}`,
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
    lastWholeTextRef.current && checkTextWithCache(lastWholeTextRef.current);
  }, [checkEndpointResponse]);

  return [alerts, checkEndpointResponse, checkEndpointError, checkTextWithCache] as const;
};
