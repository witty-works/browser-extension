import React, { useEffect, useState } from 'react';
import { StorageKeys } from '../shared/constants';
import { storeInLocalStorage } from '../shared/utils';
import { setToken } from '../shared/ApiServices/requests';
import { sendErrorToSentry } from '../shared/errorUtils';

const Options: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');

  useEffect(() => {
    window.addEventListener('load', onOptionsLoad);
    return () => {
      window.removeEventListener('load', onOptionsLoad);
    };
  }, []);

  const onOptionsLoad = (event: Event) => {
    try {
      const searchParams = new URLSearchParams(
        (event.currentTarget as Window).location.search
      );

      if ([...searchParams].length > 0) {
        setAccessToken(searchParams.get('access_token') as string);
        setRefreshToken(searchParams.get('refresh_token') as string);
        const target = searchParams.get('target')?.split('?')[0];
        storeInLocalStorage(StorageKeys.REDIRECT_URL_LOGIN, target);
        window.open(
          target ? target : 'https://www.witty.works/try-out-witty',
          '_self',
          'noopener'
        );
      }
    } catch (error) {
      sendErrorToSentry(error);
    }
  };

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
