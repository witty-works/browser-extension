import { useEffect, useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults } from './requests';
import { IRequest } from '../types';

const useEndpoint = () => {
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

export default useEndpoint;
