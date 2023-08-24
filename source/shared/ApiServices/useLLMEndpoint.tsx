import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAiAlternatives } from './requests';
import { IRequest, ICheckResponse } from '../types';

export const useLlmEndpoint = () => {
  const [aiAlternativeData, setAiAlternativeData] = useState<{
    sentenceToAnalyze: string;
    wordToBeReplaced: string;
    alternative: string;
  }>({
    sentenceToAnalyze: '',
    wordToBeReplaced: '',
    alternative: '',
  });
  const request: IRequest = useMemo(() => {
    return getAiAlternatives(aiAlternativeData.sentenceToAnalyze, aiAlternativeData.wordToBeReplaced, aiAlternativeData.alternative);
  }, [aiAlternativeData]);

  const [aiAlternativeResponse, aiAlternativeErrorResponse] = useApiResults<ICheckResponse>( //TODO: change type here after api is ready
    request,
    null,
  );

  return [aiAlternativeResponse, aiAlternativeErrorResponse, setAiAlternativeData] as const;
};
