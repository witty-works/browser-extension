import {
  IEndpointError,
  IGetLLMSuggestionsRequest,
  ILLMAlternativesResponse,
} from '../types';
import {hashString} from '../hash';

export interface LLMAlternativesCacheValue {
  data: ILLMAlternativesResponse | null;
  loading: boolean;
  error: any;
}

export type LLMSuggestionsCacheMap = Record<string, LLMAlternativesCacheValue>;

export const createIdleCacheValue = (): LLMAlternativesCacheValue => {
  return {
    data: null,
    error: null,
    loading: false,
  };
};

export const createLoadingCacheValue = (): LLMAlternativesCacheValue => {
  return {
    data: null,
    error: null,
    loading: true,
  };
};

export const getLLMAlternativesCacheKey = (
  request: IGetLLMSuggestionsRequest
): string => {
  const sentence = hashString(request.alert.data.fullSentence.raw);
  const text = request.alert.data.text;
  return `${sentence}::${text}`;
};

export const isCacheEntryResolved = (
  entry: LLMAlternativesCacheValue | undefined
): boolean => Boolean(entry?.data || entry?.error);

export const isCacheEntryLoading = (
  entry: LLMAlternativesCacheValue | undefined
): boolean => Boolean(entry?.loading);

// Reshapes a raw endpoint response into the cache value consumers expect,
// turning the plain-object `results` back into a Map.
export const buildResolvedCacheValue = (
  endpointData: ILLMAlternativesResponse | null | undefined,
  endpointError: IEndpointError | null
): LLMAlternativesCacheValue => {
  return {
    data: endpointData
      ? {
          ...endpointData,
          results: new Map(Object.entries(endpointData.results)),
        }
      : null,
    error: endpointError || null,
    loading: false,
  };
};

// The endpoint hook only tracks one in-flight request at a time; find which
// cache entry it belongs to.
export const findLoadingCacheKey = (
  cache: LLMSuggestionsCacheMap
): string | undefined => Object.keys(cache).find((key) => cache[key].loading);
