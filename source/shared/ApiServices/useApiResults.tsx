import {useState, useEffect} from 'react';
import {IEndpointError, IRequest} from '../types';
import {useLog, logTypes} from '../customHooks/useLog';
import {Validator, ValidatorResult, Schema} from 'jsonschema';
import {DEV_ENV, SCHEMA_VALIDATION_FAILED} from '../constants';
import {sendErrorToSentry} from '../errorUtils';

const validator = new Validator();

const useApiResult = <TResponse,>(
  request: IRequest | null,
  responseSchema: Schema | null
): [TResponse | null, IEndpointError | null] => {
  const validateResponse = (response: any): ValidatorResult | null => {
    if (responseSchema === null) return null;
    return validator.validate(response, responseSchema);
  };

  const [endpointResponse, setEndpointResponse] = useState<TResponse | null>(
    null
  );
  const [endpointError, setEndpointError] = useState<IEndpointError | null>(
    null
  );
  const log = useLog('useApiResult');

  useEffect(() => {
    // const container = getActiveDocument().getElementsByTagName(WTags.WW_SHADOW_ROOT_CONTAINER);
    // avoid endpoint call if no config or no container (aka plugin disabled)
    if (!request) {
      return;
    }

    if (request.config && request.url) {
      if (
        (!request.config.body && request.url.includes('check')) ||
        // (request.url.includes('check') && container && container.length === 0) || // for auth call on options page
        (request.url.includes('refresh-token') && !request.config.body)
      ) {
        return;
      }
      request.config = {...request.config};
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
            const detail = validationResult.errors
              .map((schemaError) => schemaError.stack)
              .join('; ');

            DEV_ENV &&
              console.log('validateResponse.errors', validationResult.errors);
            log(`JSON Schema Error: ${detail}`, logTypes.ERROR);

            // Returning here without reporting anything used to drop the whole
            // response on the floor: no highlights appeared, no error was
            // raised, and the result was indistinguishable from the API saying
            // the text was fine. It also left useLLMAlternativesCache waiting
            // on a request that would never resolve, so the popover span
            // whatever it had been given forever.
            //
            // A schema mismatch means the API contract moved under us, which is
            // worth a Sentry event rather than a log line nobody reads.
            sendErrorToSentry(
              new Error(`Response failed schema validation: ${detail}`)
            );
            setEndpointResponse(null);
            setEndpointError({
              status: SCHEMA_VALIDATION_FAILED,
              message: detail,
              request,
              responseSchema,
            });
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
