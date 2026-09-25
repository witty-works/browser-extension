import {useCallback, useEffect, useState} from 'react';
import {IGetLLMSuggestionsRequest} from '../types';
import {useLLMSuggestionsEndpoint} from './useEndpoint';
import type {
  LLMAlternativesCacheValue,
  LLMSuggestionsCacheMap,
} from './llmAlternativesService';
import {
  buildResolvedCacheValue,
  createIdleCacheValue,
  createLoadingCacheValue,
  findLoadingCacheKey,
  getLLMAlternativesCacheKey,
  isCacheEntryLoading,
  isCacheEntryResolved,
} from './llmAlternativesService';

export type {LLMAlternativesCacheValue, LLMSuggestionsCacheMap};

export const useLLMAlternativesCache = () => {
  const [cache, setCache] = useState<LLMSuggestionsCacheMap>({});
  const [endpointData, endpointError, setEndpointRequest] =
    useLLMSuggestionsEndpoint();

  const getKey = useCallback(
    (request: IGetLLMSuggestionsRequest): string =>
      getLLMAlternativesCacheKey(request),
    []
  );

  const fetchOrGetCached = useCallback(
    (request: IGetLLMSuggestionsRequest) => {
      const key = getKey(request);

      if (isCacheEntryResolved(cache[key])) {
        return cache[key];
      }

      if (!isCacheEntryLoading(cache[key])) {
        setCache((prevCache) => {
          return {
            ...prevCache,
            [key]: createLoadingCacheValue(),
          };
        });
        setEndpointRequest(request);
      }

      return cache[key] || createLoadingCacheValue();
    },
    [cache, getKey, setEndpointRequest]
  );

  useEffect(() => {
    if (!endpointData && !endpointError) return;

    setCache((prevCache) => {
      const activeKey = findLoadingCacheKey(prevCache);
      if (!activeKey) return prevCache;
      return {
        ...prevCache,
        [activeKey]: buildResolvedCacheValue(endpointData, endpointError),
      };
    });
  }, [endpointData, endpointError]);

  const getCachedValue = useCallback(
    (request: IGetLLMSuggestionsRequest) => {
      const key = getKey(request);
      return cache[key] || createIdleCacheValue();
    },
    [cache, getKey]
  );

  return [cache, fetchOrGetCached, getCachedValue] as const;
};
