import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults, getToken } from './requests';
import { IRequest, ICheckResponse, IRefreshTokenResponse } from '../types';
import { checkResponseSchema } from './validationSchemas';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../constants';
import { storeInLocalStorage } from '../utils';

export const useCheckEndpoint = () => {
  const [textToAnalyze, setTextToAnalyse] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');

  const request: IRequest = useMemo(() => {
    return getAnalyzedTextResults(textToAnalyze);
  }, [textToAnalyze]);

  const refreshTokenRequest: IRequest = useMemo(() => {
    return getToken(refreshToken);
  }, [refreshToken]);

  const [checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema
  );

  const [tokenResponse] = useApiResults<IRefreshTokenResponse>(
    refreshTokenRequest,
    null
  );

  //gets new access token using the refresh token if the access token has expired
  if (errorResponse && errorResponse.status == 403) {
    console.log('TOKEN EXPIRED');
    browser.storage.local.get(StorageKeys.REFRESH_TOKEN).then((result) => {
      if (result[StorageKeys.REFRESH_TOKEN] == '') return;
      setRefreshToken(result[StorageKeys.REFRESH_TOKEN]);
      if (tokenResponse) {
        console.log('tokenResponse', tokenResponse);
        storeInLocalStorage(
          StorageKeys.ACCESS_TOKEN,
          tokenResponse.access_token
        );
        storeInLocalStorage(
          StorageKeys.REFRESH_TOKEN,
          tokenResponse.refresh_token
        );
        storeInLocalStorage(StorageKeys.USERNAME, tokenResponse.email);

        //TODO: is there a better way of calling check endpoint again?
        // setTextToAnalyse('');
        // setTextToAnalyse(textToAnalyze);
      }
    });
  }

  return [checkResponse, errorResponse, setTextToAnalyse] as const;
};
