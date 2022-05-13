import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getToken } from './requests';
import { IRequest, IRefreshTokenResponse } from '../types';

export const useRefreshTokenEndpoint = () => {
  const [refreshToken, setRefreshToken] = useState<string>('');
  if (refreshToken != '') {
    console.log('useRefreshTokenEndpoint', refreshToken);

    const refreshTokenRequest: IRequest = useMemo(() => {
      return getToken(refreshToken);
    }, [refreshToken]);

    const [tokenResponse, errorResponse] = useApiResults<IRefreshTokenResponse>(
      refreshTokenRequest,
      null
    );
    return [tokenResponse, errorResponse, setRefreshToken] as const;
  }
  return [null, null, setRefreshToken] as const;
};
