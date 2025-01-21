import { useCallback, useEffect, useState } from 'react';
import { IGetLLMSuggestionsRequest, ILLMAlternativesResponse } from '../types';
import { useLLMSuggestionsEndpoint } from './useEndpoint';
import { hashString } from '../../ContentScript/utils';

export interface LLMAlternativesCacheValue {
  data: ILLMAlternativesResponse | null;
  loading: boolean;
  error: any;
}

export type LLMSuggestionsCacheMap = Record<string, LLMAlternativesCacheValue>;

export const useLLMAlternativesCache = () => {
  const [cache, setCache] = useState<LLMSuggestionsCacheMap>({});
  const [endpointData, endpointError, setEndpointRequest] = useLLMSuggestionsEndpoint();

  const getKey = useCallback((request: IGetLLMSuggestionsRequest): string => {
    const sentence = hashString(request.alert.data.fullSentence.raw);
    const text = request.alert.data.text;
    return `${sentence}::${text}`;
  }, []);

  const fetchOrGetCached = useCallback(
    (request: IGetLLMSuggestionsRequest) => {
      const key = getKey(request);

      if (cache[key]?.data || cache[key]?.error) {
        return cache[key];
      }

      if (!cache[key]?.loading) {
        setCache((prevCache) => ({
          ...prevCache,
          [key]: { data: null, error: null, loading: true },
        }));
        setEndpointRequest(request);
      }

      return cache[key] || { data: null, error: null, loading: true };
    },
    [cache, getKey, setEndpointRequest]
  );

  useEffect(() => {
    if (!endpointData && !endpointError) return;

    setCache((prevCache) => {
      const activeKey = Object.keys(prevCache).find((key) => prevCache[key].loading);
      if (!activeKey) return prevCache;
      return {
        ...prevCache,
        [activeKey]: {
          data: endpointData ? {
            ...endpointData,
            results: new Map(Object.entries(endpointData.results)),
          } : null,
          error: endpointError || null,
          loading: false,
        },
      };

    });
  }, [endpointData, endpointError]);

  const getCachedValue = useCallback(
    (request: IGetLLMSuggestionsRequest) => {
      const key = getKey(request);
      return cache[key] || { data: null, error: null, loading: false };
    },
    [cache, getKey]
  );

  return [
    cache,
    fetchOrGetCached,
    getCachedValue,
  ] as const;
}
