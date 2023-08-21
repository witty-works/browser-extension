import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAiAlternatives } from './requests';
import { IRequest, ICheckResponse } from '../types';
import { checkResponseSchema } from './validationSchemas';

export const useCheckEndpoint = () => {
  const [sentenceToAnalyze, setSentenceToAnalyse] = useState<string>('');
  const request: IRequest = useMemo(() => {
    return getAiAlternatives(sentenceToAnalyze);
  }, [sentenceToAnalyze]);

  const [checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema,
  );

  return [checkResponse, errorResponse, setSentenceToAnalyse] as const;
};
