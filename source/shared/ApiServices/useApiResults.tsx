import { useState, useEffect } from 'react';

import { IEndpointResponse, IEndpointResponseError, IRequest } from '../types';

const useApiResult = (request: IRequest, sendText: any) => {
  const [endpointResponse, setEndpointResponse] = useState<IEndpointResponse>({
    results: [],
    language: '',
  });
  const [endpointError, setEndpointError] = useState<IEndpointResponseError>({
    detail: [],
  });

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const ac = new AbortController();
    let canceled = false; // Canceled is used to avoid race conditions

    console.log('useApiResult request = ', request);
    setLoading(true);

    fetch(request.url, request.config)
      .then(async (response) => {
        if (!canceled) {
          console.log('useApiResult response = ', response);

          setLoading(false);

          if (response.ok) {
            const responseResults = await response.json();
            console.log('useApiResult responseResults = ', responseResults);
            setEndpointResponse(responseResults);
            setEndpointError({ detail: [] });
          } else {
            setEndpointError(await response.json());
          }
        }
      })
      .catch((error) => {
        console.log('useApiResult error = ', error);
        // setError(error); //TODO FIX, this is not received outside
      });
    return () => {
      ac.abort(); // Abort both fetches on unmount
      canceled = true;
      setLoading(false);
    };
  }, [request.config.body]);

  return [loading, endpointResponse, endpointError, sendText];
};

export default useApiResult;
