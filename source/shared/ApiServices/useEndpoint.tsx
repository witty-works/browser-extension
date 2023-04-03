import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults } from './requests';
import { IRequest, ICheckResponse, ICheckRequest } from '../types';
import { checkResponseSchema } from './validationSchemas';

export const useCheckEndpoint = () => {
  //object containing text to analyse and a boolean to indicate if its a repeated request
  const [textToAnalyze, setTextToAnalyse] = useState<ICheckRequest>({
    text: '',
    repeatedRequest: false,
  });
  //get repeated request in here somewhere 
  const request: IRequest = useMemo(() => {
    return getAnalyzedTextResults(textToAnalyze.text);
  }, [textToAnalyze]);

  const [checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema,
    textToAnalyze.repeatedRequest
  );

  return [checkResponse, errorResponse, setTextToAnalyse] as const;
};
