import React, {useEffect, useState} from 'react';
import browser from 'webextension-polyfill';
import {useTranslation} from 'react-i18next';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  HelpLinks,
  X_KEY,
  registerCustomEndpointFromStorage,
} from '../../shared/constants';
import {MessageTypes, SignInMessage, SignInResult} from '../../shared/messages';
import '../styles.scss';
import {namespaces} from '../../i18n/i18n.constants';
import {appID, setBaseUrls} from '../../shared/ApiServices/requests';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';
import PopupHeader from '../PopupComponents/PopupHeader';
import OptionsLink from '../PopupComponents/OptionsLink';
import SadFace from '../../assets/icons/popup/sadFace.svg';
import Star from '../../assets/icons/popup/star.svg';
import {logTypes, useLog} from '../../shared/customHooks/useLog';
import {sendErrorToSentry} from '../../shared/errorUtils';
import {addBadge} from '../../shared/utils';

const PopupLogin: React.FC = () => {
  const {t} = useTranslation([namespaces.pages.popup]);
  const [signInError, setSignInError] = useState(false);
  const [urls, setUrls] = useState<string>(DefaultBaseUrlKey);
  const log = useLog('PopupLogin');

  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  useEffect(() => {
    // If an X_KEY is configured, we don't need to show login flows
    if (X_KEY) {
      return;
    }
    addBadge('Login');
    browser.storage.local
      .get(null)
      .then((result) => {
        registerCustomEndpointFromStorage(result);
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
    const changedItems = Object.keys(changes);
    for (const item of changedItems) {
      if (item === StorageKeys.API_ENDPOINT_KEY) {
        setUrls(changes[item].newValue);
      }
    }
  };

  // The background worker owns the OAuth flow: `browser.identity` is
  // unavailable here in a way that survives, because the auth window takes
  // focus and closes this popup mid-flight.
  const logIn = async (register = false) => {
    const result = (await browser.runtime.sendMessage({
      type: MessageTypes.SIGN_IN,
      register,
    } as SignInMessage)) as SignInResult | undefined;

    if (result?.status === 'error') {
      log(`Sign-in failed: ${result.message}`, logTypes.ERROR);
      setSignInError(true);
    }
  };

  // If X_KEY is configured, show a simple notice instead of login flows
  if (X_KEY) {
    return (
      <>
        <PopupHeader showSettings={false} appId={appID} />
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer witty-works-ext-full-padding witty-works-ext-light-gray-background'>
          <div className='witty-works-ext-margin-right'>
            <SadFace />
          </div>
          <div
            className='witty-works-ext-lato-popover-text witty-works-ext-margin-left'
            style={{color: '#E6635A'}}
          >
            {t('apiKeyConfiguredNotice')}
          </div>
        </div>
        {DEV_ENV && (
          <div className='witty-works-ext-section'>
            <h2>{t('developmentSettings')}</h2>
            <ApiSelector />
            <DelaySelector />
          </div>
        )}
      </>
    );
  }

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
              style={{padding: 0}}
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
      <div className='witty-works-ext-wittyworks-container witty-works-ext-full-padding witty-works-ext-light-gray-background witty-works-ext-left'>
        <div
          className='witty-works-ext-button witty-works-ext-primary-button-red'
          onClick={() => {
            setSignInError(false);
            logIn().catch((error) => {
              log(`logIn Error: ${error}`, logTypes.ERROR);
              sendErrorToSentry(error);
              setSignInError(true);
            });
          }}
        >
          {t('signIn')}
        </div>
        <div className='witty-works-ext-lato-popup-text witty-works-ext-margin-top-half'>
          {t('dontHaveAccount')}
          &nbsp;
          <span
            id='witty-sign-up'
            className='witty-works-ext-lato-popup-text-purple witty-works-ext-cursor-pointer'
            onClick={() => {
              setSignInError(false);
              logIn(true).catch((error) => {
                log(`logIn Error: ${error}`, logTypes.ERROR);
                sendErrorToSentry(error);
                setSignInError(true);
              });
            }}
          >
            {t('signUp')}
          </span>
        </div>
      </div>
      {/*
        The old "popups blocked" branch is gone: sign-in no longer goes through
        `window.open`, so there is no popup for the browser to block. What can
        still fail is the OAuth flow itself (misconfigured client, dashboard
        unreachable), which is what this reports.
      */}
      {signInError && (
        <div className='witty-works-ext-wittyworks-container witty-works-ext-full-padding witty-works-ext-light-gray-background witty-works-ext-left witty-works-ext-margin-top'>
          <div className='witty-works-ext-lato-small-paragraph-title-h4'>
            {t('signInFailed')}
          </div>
          <div className='witty-works-ext-lato-popup-text'>
            {t('signInFailedText')}
          </div>
          <a
            id='witty-help-troubleshooting'
            className='witty-works-ext-lato-popup-text-purple'
            href={HelpLinks.notWorking}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('helpSignInFailed')}
          </a>
        </div>
      )}
      <OptionsLink />
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
