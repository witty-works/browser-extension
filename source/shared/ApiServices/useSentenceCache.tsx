import {hashString} from "../../ContentScript/utils";
import {IAlert} from "../types";
import {SentenceSplitterSyntax, split} from "sentence-splitter";
import { useRef } from "react";
import {generateAlertId} from "../utils";

interface ISentenceCache {
  [hash: string]: ICachedSentenceAlerts;
}

export interface ICachedSentenceAlerts {
  sentence: string;
  alerts: IAlert[];
}

export const useSentenceCache = () => {
  const cacheRef = useRef<ISentenceCache>({});

  const checkCache = (updatedText: string) => {
    const textWithoutLineBreaks = updatedText.replace(/\n/g, '');
    const sentences = split(textWithoutLineBreaks).filter(s => s.type === SentenceSplitterSyntax.Sentence);
    const cachedAlerts: IAlert[] = [];
    const nonCachedSentences: string[] = [];

    // console.log("currentcache", cacheRef.current);

    sentences.forEach((sentence) => {
      // console.log("sentence", sentence.raw, sentence.range[0]);
      const hash = hashString(sentence.raw);
      if (cacheRef.current[hash]) {
        // Adjust cached alert positions based on sentence's position in the new text
        const adjustedAlerts = cacheRef.current[hash].alerts.map((alert) => {
          const startOffset = alert.startOffset + sentence.range[0];
          const endOffset = alert.endOffset + sentence.range[0];
          return {
          ...alert,
            id: generateAlertId(alert.data.text, alert.data.category, startOffset, endOffset),
            startOffset,
            endOffset,
          }
        });
        cachedAlerts.push(...adjustedAlerts);
      } else {
        nonCachedSentences.push(sentence.raw);
      }
    });

    return {
      cachedAlerts,
      nonCachedSentences,
    };
  };

  const addToCache = (sentencesAlerts: ICachedSentenceAlerts[]): ISentenceCache => {
    const updatedCache = { ...cacheRef.current };

    sentencesAlerts.forEach((sentenceAlerts) => {
      const hash = hashString(sentenceAlerts.sentence);
      updatedCache[hash] = sentenceAlerts;
    });

    // console.log('settingcache', updatedCache);
    cacheRef.current = updatedCache;
    return updatedCache;
  };

  return { checkCache, addToCache };
};
