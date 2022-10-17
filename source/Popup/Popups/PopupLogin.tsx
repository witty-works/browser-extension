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
  const [urls, setUrls] = useState<string>(DEV_ENV ? 'Dev' : 'Prod');
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
      <PopupHeader showSettings={false} />
      <section>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
          <div className='witty-works-ext-margin-right'>
            <Checkmark />
          </div>
          <div className='witty-works-ext-lato-small-paragraph-title-h4'>
            {t('loginToUnlock')}
          </div>
        </div>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
          <div className='witty-works-ext-lato-popover-text'>
            {t('signUpFor')}
          </div>
        </div>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row'>
          <div className='witty-works-ext-margin-right'>
            <Star />
          </div>
          <div className='witty-works-ext-lato-popover-text'>
            {t('biasDetection')}
          </div>
        </div>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
          <div className='witty-works-ext-margin-right'>
            <Star />
          </div>
          <div className='witty-works-ext-lato-popover-text'>
            {t('inclusiveAlternatives')}
          </div>
        </div>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
          <div className='witty-works-ext-margin-right'>
            <Star />
          </div>
          <div className='witty-works-ext-lato-popover-text'>
            {t('teamFeatures')}
          </div>
        </div>
      </section>
      <div className='witty-works-ext-wittyworks-container witty-works-ext-full-padding witty-works-ext-light-gray-background witty-works-ext-left'>
        <div
          className='witty-works-ext-button witty-works-ext-primary-button-red'
          onClick={() => {
            logIn(urls);
          }}
        >
          {t('signUp')}
        </div>
        <div className='witty-works-ext-lato-popup-text'>
          {t('haveAccount')}
          &nbsp;
          <span
            className='witty-works-ext-lato-popup-text-purple witty-works-ext-cursor-pointer'
            onClick={() => {
              logIn(urls);
            }}
          >
            {t('signIn')}{' '}
          </span>
        </div>
      </div>
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
