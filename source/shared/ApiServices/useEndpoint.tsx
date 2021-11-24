import { useEffect, useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults, logAction } from './requests';
import { IRequest, ILog } from '../types';

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
  const [log, setLog] = useState<ILog>({} as ILog);

  useEffect(() => {
    return () => {
      setLog({} as ILog);
    };
  }, []);

  const request: IRequest = useMemo(() => logAction(log), [log]);

  return useApiResults(request, setLog);
};
