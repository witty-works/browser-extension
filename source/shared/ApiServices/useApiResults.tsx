import { useState, useEffect, useMemo } from 'react';

import { IEndpointResponseError, IRequest } from '../types';
import { useLog, logTypes } from '../customHooks/useLog';
import Ajv, { JSONSchemaType } from 'ajv';

const useApiResult = <TResponse,>(request: IRequest, sendData: any, responseSchema: JSONSchemaType<TResponse>): [boolean, TResponse | null, IEndpointResponseError, any] => {
  const validateResponse = useMemo(() => new Ajv().compile(responseSchema), [responseSchema]);
  const [endpointResponse, setEndpointResponse] = useState<TResponse | null>(null); //TODO update type any
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

          if (!response.ok) {
            setEndpointError(await response.json());
            return;
          }
          const responseResults: any = await response.json();
          if (!validateResponse({
            "results": [
                {
                    "text": "test",
                    "context": "test lala ",
                    "category": "orthography",
                    "subcategory": "orthography",
                    "start": 0,
                    "end": '4',
                    "alternatives": [
                        "Test"
                    ],
                    "label": "",
                    "reason": "Correct any spelling or grammatical errors to maximize the impact of their writing.",
                    "solution": "This sentence does not start with an uppercase letter."
                },
                {
                    "text": "lala",
                    "context": "test lala ",
                    "category": "orthography",
                    "subcategory": "orthography",
                    "start": 5,
                    "end": 9,
                    "alternatives": [
                        "lava",
                        "gala",
                        "Lana",
                        "Lara",
                        "Lola",
                        "Lila",
                        "lama",
                        "Bala",
                        "Fala",
                        "LACA",
                        "LAMA",
                        "Lalo",
                        "Lama",
                        "Layla",
                        "la la"
                    ],
                    "label": "Spelling mistake",
                    "reason": "Correct any spelling or grammatical errors to maximize the impact of their writing.",
                    "solution": "Possible spelling mistake found."
                }
            ],
            "language": "en"
        }) && validateResponse.errors) {
            setEndpointError({
              detail: validateResponse.errors.map((error) => ({
                  loc: [error.schemaPath],
                  msg: error.message || '',
                  type: error.keyword
              })),
            });
            return;
          }

          setEndpointResponse(responseResults);
          setEndpointError({ detail: [] });
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
