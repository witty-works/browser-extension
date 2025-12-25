import React, { useEffect, useState } from 'react';
import { BaseUrls, DefaultBaseUrlKey, StorageKeys } from '../shared/constants';
import { removeBadge, storeInLocalStorage } from '../shared/utils';
import { setToken } from '../shared/ApiServices/requests';
import { sendErrorToSentry } from '../shared/errorUtils';
import browser from 'webextension-polyfill';

const Options: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);

      if ([...searchParams].length > 0) {
        setAccessToken(searchParams.get('access_token') as string);
        setRefreshToken(searchParams.get('refresh_token') as string);
        const target = searchParams.get('target')?.split('?')[0];
        storeInLocalStorage(StorageKeys.REDIRECT_URL_LOGIN, target);
        browser.storage.local.get(null).then((result) => {
          const url = result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey;
          window.open(
            target
              ? target
              : `${BaseUrls[url].dashboard}editor?onboarding=true`,
            '_self',
            'noopener'
          );
          removeBadge();
        });
      }
    } catch (error) {
      sendErrorToSentry(error);
    }
  }, []);
  useEffect(() => {
    setToken(accessToken);
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, accessToken);
  }, [accessToken]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, refreshToken);
  }, [refreshToken]);

  return <div></div>;
};
export default Options;
