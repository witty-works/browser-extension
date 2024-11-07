import { useState, useEffect } from 'react';
import { IEndpointError, IRequest } from '../types';
import { useLog, logTypes } from '../customHooks/useLog';
import { Validator, ValidatorResult, Schema } from 'jsonschema';
import { DEV_ENV, WTags } from '../constants';
import { getActiveDocument } from '../../ContentScript/ContentScriptApp';

const validator = new Validator();

const useApiResult = <TResponse,>(
  request: IRequest,
  responseSchema: Schema | null,
): [TResponse | null, IEndpointError | null] => {
  const validateResponse = (response: any): ValidatorResult | null => {
    if (responseSchema === null) return null;
    return validator.validate(response, responseSchema);
  };

  const [endpointResponse, setEndpointResponse] = useState<TResponse | null>(null);
  const [endpointError, setEndpointError] = useState<IEndpointError | null>(null);
  const log = useLog('useApiResult');

  useEffect(() => {
    const container = getActiveDocument().getElementsByTagName(WTags.WW_SHADOW_ROOT_CONTAINER);
    // avoid endpoint call if no config or no container (aka plugin disabled)
    if (request.config && request.url) {
      if (
        (!request.config.body && request.url.includes('check')) ||
        (request.url.includes('check') && container && container.length === 0) || // for auth call on options page
        (request.url.includes('refresh-token') && !request.config.body)
      ) {
        return;
      }
      request.config = { ...request.config };
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
          const validationResult = validateResponse(responseResults);

          if (validationResult && !validationResult.valid) {
            DEV_ENV && console.log('validateResponse.errors', validationResult.errors);
            log(`JSON Schema Error: ${validationResult.errors.join(', ')}`, logTypes.ERROR);
            return;
          }

          setEndpointResponse(responseResults);
          setEndpointError(null);
        })
        .catch((error: Error) => {
          log(error.message, logTypes.ERROR);
        });
    }
  }, [request]);

  return [endpointResponse, endpointError];
};

export default useApiResult;
