import { useEffect, useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getEntities } from './requests';
import { IRequest } from '../types';

const useEntities = () => {
  const [textToAnalyze, setTextToAnalyse] = useState<string>('');

  useEffect(() => {
    return () => {
      setTextToAnalyse('');
    };
  }, []);

  const request: IRequest = useMemo(
    () => getEntities(textToAnalyze),
    [textToAnalyze]
  );
  return useApiResults(request, setTextToAnalyse);
};

export default useEntities;
