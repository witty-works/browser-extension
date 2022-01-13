import { useState, useEffect } from 'react';

import { IEndpointResponseError, IRequest } from '../types';
import { useLog, logTypes } from '../customHooks/useLog';

const useApiResult = (request: IRequest, sendData: any): [any, any, any, any] => {
  const [endpointResponse, setEndpointResponse] = useState<any>(null); //TODO update type any
  const [endpointError, setEndpointError] = useState<IEndpointResponseError>({
    detail: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const log = useLog('useApiResult');

  useEffect(() => {
    const ac = new AbortController();

    //Avoid endpoint calls if body is null
    if (request.config.body) {
      setLoading(true);

      request.config = { ...request.config, signal: ac.signal };

      log('Request:', logTypes.INFO, request);

      fetch(request.url, request.config)
        .then(async (response) => {
          log('Response: ', logTypes.INFO, response);

          setLoading(false);

          if (response.ok) {
            const responseResults = await response.json();

            log(
              `Results: Language is ${responseResults.language.toUpperCase()} and the relevant terms are: `,
              logTypes.INFO,
              responseResults.results.length > 0
                ? responseResults.results
                : 'None'
            );
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
            log(error, logTypes.ERROR);
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
