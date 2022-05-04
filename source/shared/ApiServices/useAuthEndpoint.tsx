import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getConfiguration } from './requests';
import { IRequest, IAuthResponse } from '../types';
import { checkResponseOrgConfigSchema } from './validationSchemas';

export const useAuthEndpoint = () => {
  const [config, setConfig] = useState<boolean>();
  const getConfig = () => {
    console.log('auth getConfig');
    setConfig(true);
  };

  const request: IRequest = useMemo(() => {
    console.log('auth request');
    console.log('auth request config', config);
    return getConfiguration();
  }, [config]);

  const [authResponse, authErrorResponse] = useApiResults<IAuthResponse>(
    request,
    checkResponseOrgConfigSchema
  );

  return [authResponse, authErrorResponse, getConfig] as const;
};
