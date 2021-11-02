import { useState, useEffect } from 'react';
import { DEV_ENV } from '../constants';

import { IEndpointResponseError, IRequest } from '../types';

const useApiResult = (request: IRequest, sendData: any) => {
  const [endpointResponse, setEndpointResponse] = useState<any>(null); //TODO update type any
  const [endpointError, setEndpointError] = useState<IEndpointResponseError>({
    detail: [],
  });

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const ac = new AbortController();

    //Avoid endpoint calls if body is null
    if (request.config.body) {
      setLoading(true);

      request.config = { ...request.config, signal: ac.signal };

      if (DEV_ENV) console.log('useApiResult request = ', request);

      fetch(request.url, request.config)
        .then(async (response) => {
          if (DEV_ENV) console.log('useApiResult response = ', response);

          setLoading(false);

          if (response.ok) {
            const responseResults = await response.json();
            if (DEV_ENV)
              console.log('useApiResult responseResults = ', responseResults);
            setEndpointResponse(responseResults);
            setEndpointError({ detail: [] });
          } else {
            setEndpointError(await response.json());
          }
        })
        .catch((error) => {
          // AbortError is created when a request is aborted.
          // We don't need to shown an error message in this case
          if (error.name !== 'AbortError') {
            if (DEV_ENV) console.log('useApiResult error = ', error);
            // setError(error); //TODO FIX, this is not received outside
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }

    return () => {
      ac.abort(); // Abort fetch on unmount
    };
  }, [request.config.body]);

  return [loading, endpointResponse, endpointError, sendData];
};

export default useApiResult;
