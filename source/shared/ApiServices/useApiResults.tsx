import { useState, useEffect, useMemo } from 'react';

import { IEndpointError, IEndpointResponseError, IRequest } from '../types';
import { useLog, logTypes } from '../customHooks/useLog';
import Ajv, { JSONSchemaType } from 'ajv';

const useApiResult = <TResponse,>(
  request: IRequest,
  responseSchema: JSONSchemaType<TResponse> | null
): [TResponse | null, IEndpointError | null] => {
  console.log('useApiResult request', request);
  console.log('useApiResult responseSchema', responseSchema);

  const validateResponse =
    responseSchema === null
      ? null
      : useMemo(() => new Ajv().compile(responseSchema), [responseSchema]);

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
            const error: { detail: IEndpointResponseError[] } =
              await response.json();
            setEndpointError({
              status: response.status,
              message: error.detail
                .map((detail: IEndpointResponseError) => detail.msg)
                .join(', '),
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
