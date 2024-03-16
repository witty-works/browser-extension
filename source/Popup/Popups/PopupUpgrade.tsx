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
import {
  appID,
  getBaseUrls,
  setBaseUrls,
} from '../../shared/ApiServices/requests';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';
import PopupHeader from '../PopupComponents/PopupHeader';
import SadFace from '../../assets/icons/popup/sadFace.svg';
import { logTypes, useLog } from '../../shared/customHooks/useLog';
import { sendErrorToSentry } from '../../shared/errorUtils';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';
import { storeInLocalStorage } from '../../shared/utils';

const PopupUpgrade: React.FC = () => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const [teamName, setTeamName] = useState<string>('');
  const log = useLog('PopupLogin');
  const analytics = useAnalytics();
  
  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        setTeamName(result[StorageKeys.TEAM_NAME]);
      })
      .catch(onStorageError);
  }, []);

  const handleUpgradeClick = () => {
    analytics.dashboardLog('upgrade_popup');
    window.open(getBaseUrls().dashboard + 'team/subscription', '_blank');
  }

  const logOut = () => {
    storeInLocalStorage(StorageKeys.PLAN, '');
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, '');
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, '');
  }

  return (
    <>
      <PopupHeader showSettings={false} appId={appID} />
      <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer witty-works-ext-full-padding witty-works-ext-light-gray-background'>
        <div className='witty-works-ext-margin-right'>
          <SadFace />
        </div>
        <div className='witty-works-ext-lato-popover-text witty-works-ext-margin-left'>
          {t('upgradeHeadline')}
          <div
            className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer '
            style={{ padding: 0 }}
          >
           <div className='witty-works-ext-margin-right'>
              {t('upgradeText')}
            </div>
          </div>
        </div>
      </div>

      <div className='witty-works-ext-left witty-works-ext-margin-top'>
        <button className='witty-works-ext-button witty-works-ext-primary-button-red' onClick={handleUpgradeClick}>
          {t('upgradeButton')}
        </button>
      </div>     

      {teamName && (
        <div className='witty-works-ext-section'>
          <div className='witty-works-ext-lato-popup-text'>
            {t('loggedInTo') + ' "' + teamName + '"'}
          </div>
        </div>
      )}
      
      {DEV_ENV && (
        <div className='witty-works-ext-section'>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
          <div className='witty-works-ext-left'>
            <button className='witty-works-ext-button witty-works-ext-primary-button-red' onClick={logOut}>
              {t('signOut')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PopupUpgrade;
