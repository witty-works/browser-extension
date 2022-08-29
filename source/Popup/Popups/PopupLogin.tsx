import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { useTranslation } from 'react-i18next';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
} from '../../shared/constants';
import '../../i18n/i18n';
import '../styles.scss';
import { namespaces } from '../../i18n/i18n.constants';
import { setBaseUrls } from '../../shared/ApiServices/requests';
import { logIn } from '../PopupUtils';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';
import PopupHeader from '../PopupComponents/PopupHeader';
import Star from '../../assets/icons/popup/star.svg';
import Checkmark from '../../assets/icons/popup/checkmark.svg';
import { logTypes, useLog } from '../../shared/customHooks/useLog';
import { sendErrorToSentry } from '../../shared/errorUtils';

const PopupLogin: React.FC = () => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const [urls, setUrls] = useState<string>('Prod');
  const log = useLog('PopupLogin');

  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
      })
      .catch(onStorageError);
    browser.storage.onChanged.addListener(storageChange);

    return () => {
      browser.storage.onChanged.removeListener(storageChange);
    };
  }, []);

  useEffect(() => {
    setBaseUrls(urls);
  }, [urls]);

  const storageChange = (changes: any) => {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      if (item === StorageKeys.API_ENDPOINT_KEY) {
        setUrls(changes[item].newValue);
      }
    }
  };

  return (
    <>
      <PopupHeader />
      <section>
        <div className='wittyworks-signin-container'>
          <div className='wittyworks-signin-benefits-list-icon'>
            <Checkmark />
          </div>
          <div className='wittyworks-signin-benefits-list-text-large'>
            {t('loginToUnlock')}
          </div>
        </div>
        <div className='wittyworks-signin-list'>
          <div className='wittyworks-signin-benefits-list-text'>
            {t('signUpFor')}
          </div>
          <div className='wittyworks-signin-container'>
            <div className='wittyworks-signin-benefits-list-icon'>
              <Star />
            </div>
            <div className='wittyworks-signin-benefits-list-text'>
              {t('biasDetection')}
            </div>
          </div>
          <div className='wittyworks-signin-container'>
            <div className='wittyworks-signin-benefits-list-icon'>
              <Star />
            </div>
            <div className='wittyworks-signin-benefits-list-text'>
              {t('inclusiveAlternatives')}
            </div>
          </div>
          <div className='wittyworks-signin-container'>
            <div className='wittyworks-signin-benefits-list-icon'>
              <Star />
            </div>
            <div className='wittyworks-signin-benefits-list-text'>
              {t('teamFeatures')}
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className='wittyworks-signin'>
          <div className='wittyworks-align-left'>
            <div
              className='wittyworks-button'
              onClick={() => {
                logIn(urls);
              }}
            >
              {t('signIn')}
            </div>
          </div>
          <div className='wittyworks-signin-benefits-list-text-small'>
            {t('register')}
            <span
              className='wittyworks-sigin-link'
              onClick={() => {
                logIn(urls);
              }}
            >
              {t('signUp')}{' '}
            </span>
          </div>
        </div>
      </section>
      {DEV_ENV && (
        <section>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
        </section>
      )}
    </>
  );
};

export default PopupLogin;
