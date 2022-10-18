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
import { getBaseUrls, setBaseUrls } from '../../shared/ApiServices/requests';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';
import PopupHeader from '../PopupComponents/PopupHeader';
import Star from '../../assets/icons/popup/star.svg';
import Checkmark from '../../assets/icons/popup/checkmark.svg';
import { logTypes, useLog } from '../../shared/customHooks/useLog';
import { sendErrorToSentry } from '../../shared/errorUtils';

const PopupLogin: React.FC = () => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const [popupsBlocked, setPopupsBlocked] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
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

  const logIn = async (urls: string) => {
    const optionsPageUrl = browser.extension.getURL('options.html');

    browser.storage.local.get(null).then((result) => {
      if (!result[StorageKeys.REDIRECT_URL_LOGIN]) {
        const url = `${BaseUrls[urls].dashboard}api/browser-login?redirect_uri=${optionsPageUrl}?target=https://www.witty.works/try-out-witty`;
        if (!window.open(url, '_blank')) {
          setPopupsBlocked(true);
          setLoginUrl(url);
        }
      } else {
        const url = `${
          BaseUrls[urls].dashboard
        }api/browser-login?redirect_uri=${optionsPageUrl}?target=${
          getBaseUrls().dashboard
        }`;
        if (!window.open(url, '_blank')) {
          setPopupsBlocked(true);
          setLoginUrl(url);
        }
      }
    });
  };

  return (
    <>
      <PopupHeader showSettings={false} />
      <section>
        <div className='wittyworks-container container-row justify-start'>
          <div className='margin-right'>
            <Checkmark />
          </div>
          <div className='lato-small-paragraph-title-h4'>
            {t('loginToUnlock')}
          </div>
        </div>
        <div className='wittyworks-container container-row justify-start'>
          <div className='lato-popover-text'>{t('signUpFor')}</div>
        </div>
        <div className='wittyworks-container container-row'>
          <div className='margin-right'>
            <Star />
          </div>
          <div className='lato-popover-text'>{t('biasDetection')}</div>
        </div>
        <div className='wittyworks-container container-row justify-start'>
          <div className='margin-right'>
            <Star />
          </div>
          <div className='lato-popover-text'>{t('inclusiveAlternatives')}</div>
        </div>
        <div className='wittyworks-container container-row justify-start'>
          <div className='margin-right'>
            <Star />
          </div>
          <div className='lato-popover-text'>{t('teamFeatures')}</div>
        </div>
      </section>
      <div className='wittyworks-container full-padding light-gray-background left'>
        <div
          className='button primary-button-red'
          onClick={() => {
            logIn(urls).catch((error) => {
              log(`logIn Error: ${error}`, logTypes.ERROR);
              sendErrorToSentry(error);
              setPopupsBlocked(true);
            });
          }}
        >
          {t('signUp')}
        </div>
        <div className='lato-popup-text'>
          {t('haveAccount')}
          &nbsp;
          <span
            className='lato-popup-text-purple cursor-pointer'
            onClick={() => {
              logIn(urls).catch((error) => {
                log(`logIn Error: ${error}`, logTypes.ERROR);
                sendErrorToSentry(error);
                setPopupsBlocked(true);
              });
            }}
          >
            {t('signIn')}{' '}
          </span>
        </div>
      </div>
      {popupsBlocked && (
        <div className='wittyworks-container full-padding light-gray-background left margin-top'>
          <div className='lato-small-paragraph-title-h4'>
            {t('popupsBlocked')}
          </div>
          <div className='lato-popup-text'>{t('popupsBlockedText')}</div>
          <div
            className='button primary-button-red margin-top'
            onClick={() => {
              navigator.clipboard.writeText(loginUrl);
            }}
          >
            {t('copyLink')}
          </div>
        </div>
      )}
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
