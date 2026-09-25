import {useMemo, useState} from 'react';
import useApiResults from './useApiResults';
import {getConfiguration} from './requests';
import {IRequest, IAuthResponse} from '../types';
// import { checkResponseOrgConfigSchema } from './validationSchemas';

export const useAuthEndpoint = () => {
  const [config, setConfig] = useState<boolean>(false);

  const request: IRequest = useMemo(() => getConfiguration(), [config]);

  const [authResponse, authErrorResponse] = useApiResults<IAuthResponse>(
    request,
    // checkResponseOrgConfigSchema //TODO: FIX VALIDATION ERRORS
    null
  );

  return [authResponse, authErrorResponse, setConfig] as const;
};
