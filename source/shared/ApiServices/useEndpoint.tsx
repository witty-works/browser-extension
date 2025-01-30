import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults, getLLMSuggestion } from './requests';
import { IRequest, ICheckResponse, IGetLLMSuggestionsRequest, ILLMAlternativesResponse } from '../types';
import { checkResponseSchema, llmAlternativesResponseSchema } from './validationSchemas';

export const useCheckEndpoint = () => {
  const [textToAnalyze, setTextToAnalyse] = useState<string>('');
  const request: IRequest = useMemo(() => {
    return getAnalyzedTextResults(textToAnalyze);
  }, [textToAnalyze]);

  const [checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema,
  );

  return [checkResponse, errorResponse, setTextToAnalyse] as const;
};

export const useLLMSuggestionsEndpoint = () => {
  const [LLMSuggestionsRequest, setLLMSuggestionsRequest] = useState<IGetLLMSuggestionsRequest | null>(null);

  const request: IRequest | null = useMemo(() => {
    if (!LLMSuggestionsRequest) {
      return null;
    }

    return getLLMSuggestion(
      LLMSuggestionsRequest.alert.data.fullSentence,
      LLMSuggestionsRequest.alert
    );
  }, [LLMSuggestionsRequest]);

  let [llmAlternativesResponse, errorResponse] = useApiResults<ILLMAlternativesResponse>(
    request,
    llmAlternativesResponseSchema
  );

  return [llmAlternativesResponse, errorResponse, setLLMSuggestionsRequest] as const;
};
