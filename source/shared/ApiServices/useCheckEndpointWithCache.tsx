import {useEffect, useRef, useState} from 'react';
import {useSentenceCache} from './useSentenceCache';
import {CheckBudget} from './checkBudget';
import {MAX_CHAR_LENGTH_REQUEST} from '../constants';
import {ICheckResponse} from '../types';
import {useCheckEndpoint} from './useEndpoint';
import type {CheckEndpointCachedResponse} from './checkService';
import {
  adjustAlertPositions,
  buildCachedResponse,
  buildSentenceAlertsFromResponse,
} from './checkService';

export const useCheckEndpointWithCache = (
  onCheckResultsReceived: (
    result: ICheckResponse,
    checkedTextLength: number
  ) => void
) => {
  const {checkCache, addToCache} = useSentenceCache();
  const [cachedCheckEndpointResponse, setCachedCheckEndpointResponse] =
    useState<CheckEndpointCachedResponse | null>(null);
  const cachedCheckEndpointResponseRef =
    useRef<CheckEndpointCachedResponse | null>(null);
  const [checkEndpointResponse, checkEndpointError, setTextToCheck] =
    useCheckEndpoint();
  const lastCheckedTextRef = useRef<string | null>(null);
  const lastBatchSizeRef = useRef(0);
  const lastWholeTextRef = useRef<string | null>(null);
  const budgetRef = useRef(new CheckBudget(MAX_CHAR_LENGTH_REQUEST));

  const checkTextWithCache = (
    updatedText: string,
    checkEndpointResponse?: ICheckResponse
  ) => {
    lastWholeTextRef.current = updatedText;
    const {cachedAlerts, nonCachedSentences: uncachedSentences} =
      checkCache(updatedText);

    if (uncachedSentences.length > 0) {
      // One batch per request, within the API's limit; the response handler
      // below sends the next one until every sentence is cached. A sentence
      // longer than the budget goes on its own.
      const batch = [uncachedSentences[0]];
      let length = uncachedSentences[0].length;
      for (const sentence of uncachedSentences.slice(1)) {
        length += 1 + sentence.length;
        if (length > budgetRef.current.value) break;
        batch.push(sentence);
      }
      const textToCheck = batch.join(' ');
      lastCheckedTextRef.current = textToCheck;
      lastBatchSizeRef.current = batch.length;
      setTextToCheck(textToCheck);
    }

    const response = buildCachedResponse(cachedAlerts, checkEndpointResponse);
    setCachedCheckEndpointResponse(response);
    cachedCheckEndpointResponseRef.current = response;
  };

  const adjustLocalAlertPositions = (
    changedOffset: number,
    originalLength: number,
    newLength: number
  ) => {
    if (!cachedCheckEndpointResponseRef.current) {
      return;
    }

    const {alerts} = cachedCheckEndpointResponseRef.current;
    const adjustedAlerts = adjustAlertPositions(
      alerts,
      changedOffset,
      originalLength,
      newLength
    );

    const response = buildCachedResponse(
      adjustedAlerts,
      cachedCheckEndpointResponseRef.current.checkEndpointResponse
    );
    setCachedCheckEndpointResponse(response);
    cachedCheckEndpointResponseRef.current = response;
  };

  useEffect(() => {
    if (!(checkEndpointResponse && lastCheckedTextRef.current)) {
      return;
    }

    onCheckResultsReceived(
      checkEndpointResponse,
      (lastCheckedTextRef.current && lastCheckedTextRef.current.length) || 0
    );

    // The API checked only the start of a batch it flags `limit_reached`:
    // caching all of it would count the rest as checked, with no alerts. So
    // it is sent again in smaller batches. A single sentence too long for the
    // API is cached with what came back, as the most there is to get.
    const retrySmaller =
      checkEndpointResponse.limit_reached &&
      lastBatchSizeRef.current > 1 &&
      budgetRef.current.shrink();
    if (!retrySmaller) {
      addToCache(
        buildSentenceAlertsFromResponse(
          checkEndpointResponse,
          lastCheckedTextRef.current
        )
      );
    }
    lastWholeTextRef.current &&
      checkTextWithCache(lastWholeTextRef.current, checkEndpointResponse);
  }, [checkEndpointResponse]);

  return [
    cachedCheckEndpointResponse,
    checkEndpointError,
    checkTextWithCache,
    adjustLocalAlertPositions,
  ] as const;
};
