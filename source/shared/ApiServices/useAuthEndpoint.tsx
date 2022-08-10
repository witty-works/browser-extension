import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getConfiguration } from './requests';
import { IRequest, IAuthResponse } from '../types';
// import { checkResponseOrgConfigSchema } from './validationSchemas';

export const useAuthEndpoint = () => {
  const [config, setConfig] = useState<number>();
  const getConfig = () => {
    //find better way to do this
    const random = Math.random();
    setConfig(random);
  };

  const request: IRequest = useMemo(() => {
    return getConfiguration();
  }, [config]);

  const [authResponse, authErrorResponse] = useApiResults<IAuthResponse>(
    request,
    // checkResponseOrgConfigSchema //TODO: FIX VALIDATION ERRORS
    null
  );

  return [authResponse, authErrorResponse, getConfig] as const;
};
