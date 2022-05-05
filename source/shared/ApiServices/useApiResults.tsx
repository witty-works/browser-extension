import { useState, useEffect } from 'react';

import { IEndpointError, IRequest } from '../types';
import { useLog, logTypes } from '../customHooks/useLog';
import Ajv, { JSONSchemaType } from 'ajv';
const ajv = new Ajv();

const useApiResult = <TResponse,>(
  request: IRequest,
  responseSchema: JSONSchemaType<TResponse> | null
): [TResponse | null, IEndpointError | null] => {
  const validateResponse =
    responseSchema === null ? null : ajv.compile(responseSchema);

  const [endpointResponse, setEndpointResponse] = useState<TResponse | null>(
    null
  );

  const [endpointError, setEndpointError] = useState<IEndpointError | null>(
    null
  );
  const log = useLog('useApiResult');

  useEffect(() => {
    const ac = new AbortController();

    //Avoid endpoint calls if config is null

    if (request.config) {
      request.config = { ...request.config, signal: ac.signal };

      log('Request:', logTypes.INFO, request);

      fetch(request.url, request.config)
        .then(async (response) => {
          log('Response: ', logTypes.INFO, response);

          if (!response.ok) {
            setEndpointError({
              status: response.status,
              message: response.statusText,
            });
            return;
          }
          const responseResults: any = await response.json();

          if (
            validateResponse &&
            !validateResponse(responseResults) &&
            validateResponse.errors
          ) {
            console.log('validateResponse.errors', validateResponse.errors);
            log(
              `JSON Schema Error: ${validateResponse.errors.join(', ')}`,
              logTypes.ERROR
            );
            return;
          }

          setEndpointResponse(responseResults);
          setEndpointError(null);
        })
        .catch((error: Error) => {
          // AbortError is created when a request is aborted.
          // We don't need to shown an error message in this case
          if (error.name !== 'AbortError') {
            log(error.message, logTypes.ERROR);
          }
        });
    }

    return () => {
      ac.abort(); // Abort fetch on unmount
    };
  }, [request]);

  return [endpointResponse, endpointError];
};

export default useApiResult;
