import {useEffect, useRef, useState} from 'react';
import {useSentenceCache} from './useSentenceCache';
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
  const lastWholeTextRef = useRef<string | null>(null);

  const checkTextWithCache = (
    updatedText: string,
    checkEndpointResponse?: ICheckResponse
  ) => {
    lastWholeTextRef.current = updatedText;
    const {cachedAlerts, nonCachedSentences: uncachedSentences} =
      checkCache(updatedText);

    if (uncachedSentences.length > 0) {
      const textToCheck = uncachedSentences.join(' ');
      lastCheckedTextRef.current = textToCheck;
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

    addToCache(
      buildSentenceAlertsFromResponse(
        checkEndpointResponse,
        lastCheckedTextRef.current
      )
    );
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
