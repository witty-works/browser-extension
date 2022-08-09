import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { useTranslation } from 'react-i18next';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  BaseUrls,
} from '../shared/constants';
import { sendErrorToSentry } from '../shared/errorUtils';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';
import { useLog, logTypes } from '../shared/customHooks/useLog';
import ApiSelector from './ApiSelector';
import DelaySelector from './DelaySelector';
import './styles.scss';
import { setBaseUrls } from '../shared/ApiServices/requests';
import PopupHeader from './PopupHeader';
import Star from '../assets/icons/popup/star.svg';
import Checkmark from '../assets/icons/popup/Checkmark.svg';

const PopupLogin: React.FC = () => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const log = useLog('Popup');
  const [urls, setUrls] = useState<string>('Prod');

  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  const logIn = async () => {
    const optionsPageUrl =
      'chrome-extension://' + browser.runtime.id + '/options.html';
    const url = `${BaseUrls[urls].dashboard}api/browser-login?redirect_uri=${optionsPageUrl}`;
    window.open(url, '_blank');
  };

  const register = async () => {
    const url = `${BaseUrls[urls].dashboard}oauth/azureadb2c/register`;
    window.open(url, '_blank');
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
      switch (item) {
        case StorageKeys.API_ENDPOINT_KEY:
          setUrls(changes[item].newValue);
          break;
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
          <div
            className='wittyworks-signin-button'
            onClick={() => {
              logIn();
            }}
          >
            {t('signIn')}
          </div>
          <div className='wittyworks-signin-benefits-list-text-small'>
            {t('register')}
            <span
              className='wittyworks-sigin-link'
              onClick={() => {
                register();
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
