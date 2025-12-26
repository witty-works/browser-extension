import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults, getLLMSuggestion } from './requests';
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
  const [textToAnalyze, setTextToAnalyse] = useState<string>('');
  const request: IRequest = useMemo(() => {
    return getAnalyzedTextResults(textToAnalyze);
  }, [textToAnalyze]);

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

  let [llmAlternativesResponse, errorResponse] =
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
