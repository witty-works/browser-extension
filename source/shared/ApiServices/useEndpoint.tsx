import { useEffect, useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults, logAlternative } from './requests';
import { IRequest, IAlternative } from '../types';

export const useCheckEndpoint = () => {
  const [textToAnalyze, setTextToAnalyse] = useState<string>('');

  useEffect(() => {
    return () => {
      setTextToAnalyse('');
    };
  }, []);

  const request: IRequest = useMemo(
    () => getAnalyzedTextResults(textToAnalyze),
    [textToAnalyze]
  );

  return useApiResults(request, setTextToAnalyse);
};

export const useLogEndpoint = () => {
  const [alternative, setAlternative] = useState<IAlternative>(
    {} as IAlternative
  );

  useEffect(() => {
    return () => {
      setAlternative({} as IAlternative);
    };
  }, []);

  const request: IRequest = useMemo(
    () => logAlternative(alternative),
    [alternative]
  );

  return useApiResults(request, setAlternative);
};
