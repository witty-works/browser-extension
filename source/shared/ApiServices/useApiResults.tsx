import { useState, useEffect } from 'react';

import { IEntitiesResponse, IEntitiesResponseError, IRequest } from '../types';

const useApiResult = (request: IRequest, sendText: any) => {
  const [results, setResults] = useState<IEntitiesResponse>({
    entities: [],
    language: '',
  });
  const [error, setError] = useState<IEntitiesResponseError>({ detail: [] });

  useEffect(() => {
    const ac = new AbortController();
    fetch(request.url, request.config)
      .then(async (response) => {
        // console.log('useApiResult response = ', response);

        if (response.ok) {
          setResults(await response.json());
          setError({ detail: [] });
        } else {
          setError(await response.json());
        }
      })
      .catch((error) => {
        console.log('useApiResult error = ', error);
        // setError(error);   //FIX, this is not received outside
      });
    return () => ac.abort(); // Abort both fetches on unmount
  }, [request.config.body]);

  return [results, error, sendText];
};

export default useApiResult;
