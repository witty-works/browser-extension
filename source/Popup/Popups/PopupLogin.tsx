import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { useTranslation } from 'react-i18next';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  BaseUrls,
} from '../../shared/constants';
import '../../i18n/i18n';
import '../styles.scss';
import { namespaces } from '../../i18n/i18n.constants';
import {
  appID,
  setBaseUrls,
} from '../../shared/ApiServices/requests';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';
import PopupHeader from '../PopupComponents/PopupHeader';
import SadFace from '../../assets/icons/popup/sadFace.svg';
import Star from '../../assets/icons/popup/star.svg';
import { logTypes, useLog } from '../../shared/customHooks/useLog';
import { sendErrorToSentry } from '../../shared/errorUtils';

const PopupLogin: React.FC = () => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const [popupsBlocked, setPopupsBlocked] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [displayCopiedMessage, setDisplayCopiedMessage] = useState(false);
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

  const logIn = async (urls: string, register = false) => {
    const optionsPageUrl = browser.extension.getURL('options.html');
    const registerString = register ? 'register=true&' : '';
    const url = `${BaseUrls[urls].dashboard}browser-login?${registerString}redirect_uri=${optionsPageUrl}?target=${BaseUrls[urls].dashboard}editor?onboarding=true`;
    if (!window.open(url, '_blank')) {
      setPopupsBlocked(true);
      setLoginUrl(url);
    }
  };

  return (
    <>
      <PopupHeader showSettings={false} appId={appID} />
      <div>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer witty-works-ext-full-padding witty-works-ext-light-gray-background'>
          <div className='witty-works-ext-margin-right'>
            <SadFace />
          </div>
          <div className='witty-works-ext-lato-popover-text witty-works-ext-margin-left'>
            {t('loginToUnlock')}

            <div
              className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer '
              style={{ padding: 0 }}
            >
              <div className='witty-works-ext-margin-right'>
                {t('signedOutText')}
              </div>
            </div>
          </div>
        </div>

        <div className='witty-works-ext-full-padding'>
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
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
          <div className='witty-works-ext-container-row witty-works-ext-justify-start'>
            <div className='witty-works-ext-margin-right'>
              <Star />
            </div>
            <div className='witty-works-ext-lato-popover-text'>
              {t('teamFeatures')}
            </div>
          </div>
        </div>
      </div>
      {!popupsBlocked && (
        <div className='witty-works-ext-wittyworks-container witty-works-ext-full-padding witty-works-ext-light-gray-background witty-works-ext-left'>
          <div
            className='witty-works-ext-button witty-works-ext-primary-button-red'
            onClick={() => {
              logIn(urls).catch((error) => {
                log(`logIn Error: ${error}`, logTypes.ERROR);
                sendErrorToSentry(error);
                setPopupsBlocked(true);
              });
            }}
          >
            {t('signIn')}
          </div>
          <div className='witty-works-ext-lato-popup-text witty-works-ext-margin-top-half'>
            {t('dontHaveAccount')}
            &nbsp;
            <span
              className='witty-works-ext-lato-popup-text-purple witty-works-ext-cursor-pointer'
              onClick={() => {
                logIn(urls, true).catch((error) => {
                  log(`logIn Error: ${error}`, logTypes.ERROR);
                  sendErrorToSentry(error);
                  setPopupsBlocked(true);
                });
              }}
            >
              {t('signUp')}
            </span>
          </div>
        </div>
      )}
      {popupsBlocked && (
        <div className='witty-works-ext-wittyworks-container witty-works-ext-full-padding witty-works-ext-light-gray-background witty-works-ext-left witty-works-ext-margin-top'>
          <div className='witty-works-ext-lato-small-paragraph-title-h4'>
            {t('popupsBlocked')}
          </div>
          <div className='witty-works-ext-lato-popup-text'>
            {t('popupsBlockedText')}
          </div>
          <div className='witty-works-ext-container-row witty-works-ext-justify-start'>
            <div
              className='witty-works-ext-button witty-works-ext-primary-button-red witty-works-ext-margin-top'
              onClick={() => {
                navigator.clipboard.writeText(loginUrl);
                setDisplayCopiedMessage(true);
                setTimeout(() => {
                  setDisplayCopiedMessage(false);
                }, 1500);
              }}
            >
              {t('copyLink')}
            </div>
            {displayCopiedMessage && (
              <div
                className='witty-works-ext-lato-popup-text'
                style={{ marginTop: '1.5em' }}
              >
                {t('copiedConfirmation')}
              </div>
            )}
          </div>
        </div>
      )}
      {DEV_ENV && (
        <div className='witty-works-ext-section'>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
        </div>
      )}
    </>
  );
};

export default PopupLogin;
