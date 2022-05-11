import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults } from './requests';
import { IRequest, ICheckResponse } from '../types';
import { checkResponseSchema } from './validationSchemas';

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
