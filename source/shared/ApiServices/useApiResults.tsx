import { useState, useEffect, useMemo } from "react";

import { IEndpointResponseError, IRequest } from "../types";
import { useLog, logTypes } from "../customHooks/useLog";
import Ajv, { JSONSchemaType } from "ajv";

const useApiResult = <TResponse,>(
  request: IRequest,
  responseSchema: JSONSchemaType<TResponse>
): [boolean, TResponse | null, IEndpointResponseError] => {
  const validateResponse = useMemo(
    () => new Ajv().compile(responseSchema),
    [responseSchema]
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [endpointResponse, setEndpointResponse] = useState<TResponse | null>(
    null
  );
  const [endpointError, setEndpointError] = useState<IEndpointResponseError>({
    detail: [],
  });
  const log = useLog("useApiResult");

  useEffect(() => {
    const ac = new AbortController();

    //Avoid endpoint calls if body is null
    if (request.config.body) {
      setLoading(true);

      request.config = { ...request.config, signal: ac.signal };

      log("Request:", logTypes.INFO, request);

      fetch(request.url, request.config)
        .then(async (response) => {
          log("Response: ", logTypes.INFO, response);

          setLoading(false);

          if (!response.ok) {
            setEndpointError(await response.json());
            return;
          }
          const responseResults: any = await response.json();
          console.error(responseResults);
          if (!validateResponse(responseResults) && validateResponse.errors) {
            setEndpointError({
              detail: validateResponse.errors.map((error) => ({
                loc: [error.schemaPath],
                msg: error.message || "",
                type: error.keyword,
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
          if (error.name !== "AbortError") {
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
  }, [request]);

  return [loading, endpointResponse, endpointError];
};

export default useApiResult;
