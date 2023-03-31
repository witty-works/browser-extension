import { useState, useEffect } from 'react';

import { IEndpointError, IRequest } from '../types';
import { useLog, logTypes } from '../customHooks/useLog';
import Ajv, { JSONSchemaType } from 'ajv';
import { DEV_ENV, WTags } from '../constants';
import { getActiveDocument } from '../../ContentScript/ContentScriptApp';
const ajv = new Ajv();

const useApiResult = <TResponse,>(
  request: IRequest,
  responseSchema: JSONSchemaType<TResponse> | null,
  repeatedRequest: boolean = false
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
    const container = getActiveDocument().getElementsByTagName(
      WTags.WW_CONTAINER
    );
    const ac = new AbortController();
    //avoid enpoint call if no config or no container (aka plugin disabled)
    if (request.config && request.url) {
      if (
        (!request.config.body && request.url.includes('check')) ||
        (request.url.includes('check') && container && container.length == 0) || //for auth call on options page
        (request.url.includes('refresh-token') && !request.config.body)
      ) {
        return;
      }
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
            DEV_ENV &&
              console.log('validateResponse.errors', validateResponse.errors);
            log(
              `JSON Schema Error: ${validateResponse.errors.join(', ')}`,
              logTypes.ERROR
            );
            return;
          }
          console.log('responseResults: ', responseResults);


          setEndpointResponse(responseResults);
          setEndpointError(null);
        })

        .catch((error: Error) => {
          console.log('error: ', error, error.name);
          !repeatedRequest && setEndpointError({
            status: 0,
            message: error.message,
            request: request,
            responseSchema: responseSchema,
          });
          
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
    // });
  }, [request]);

  return [endpointResponse, endpointError];
};

export default useApiResult;
