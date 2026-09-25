import {useCallback, useMemo, useState} from 'react';
import useApiResults from './useApiResults';
import {getAnalyzedTextResults, getLLMSuggestion} from './requests';
import defaultConfig from '../../witty.config.json';
import {
  IRequest,
  ICheckResponse,
  IGetLLMSuggestionsRequest,
  ILLMAlternativesResponse,
} from '../types';
import {
  checkResponseSchema,
  llmAlternativesResponseSchema,
} from './validationSchemas';

export const useCheckEndpoint = () => {
  // Every call sends a request, the same text too: after a failed request,
  // the batch that failed is asked for again. `sent` tells the calls apart.
  const [toAnalyze, setToAnalyze] = useState({text: '', sent: 0});
  const request: IRequest = useMemo(
    () => getAnalyzedTextResults(toAnalyze.text),
    [toAnalyze]
  );
  const setTextToAnalyse = useCallback((text: string): void => {
    setToAnalyze(({sent}) => {
      return {text, sent: sent + 1};
    });
  }, []);

  const [checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema
  );

  return [checkResponse, errorResponse, setTextToAnalyse] as const;
};

export const useLLMSuggestionsEndpoint = () => {
  const [LLMSuggestionsRequest, setLLMSuggestionsRequest] =
    useState<IGetLLMSuggestionsRequest | null>(null);
  // If REPHRASE is disabled in config, skip calling the /rephrase endpoint and
  // let callers rely on existing fallback logic.
  if (!defaultConfig.REPHRASE_ENABLED) {
    const [llmAlternativesResponse, errorResponse] = [null, null] as const;
    return [
      llmAlternativesResponse,
      errorResponse,
      setLLMSuggestionsRequest,
    ] as const;
  }

  const request: IRequest | null = useMemo(() => {
    if (!LLMSuggestionsRequest) {
      return null;
    }

    return getLLMSuggestion(
      LLMSuggestionsRequest.alert.data.fullSentence,
      LLMSuggestionsRequest.alert
    );
  }, [LLMSuggestionsRequest]);

  const [llmAlternativesResponse, errorResponse] =
    useApiResults<ILLMAlternativesResponse>(
      request,
      llmAlternativesResponseSchema
    );

  return [
    llmAlternativesResponse,
    errorResponse,
    setLLMSuggestionsRequest,
  ] as const;
};
