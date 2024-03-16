import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { useTranslation } from 'react-i18next';

import {
  ConfigProperty,
  EnableWittyToggle,
} from '../../shared/types';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  TESTING,
} from '../../shared/constants';
import {
  addBadge,
  addNotificationBadge,
  getNewAccessToken,
  removeBadge,
  storeInLocalStorage,
} from '../../shared/utils';
import { namespaces } from '../../i18n/i18n.constants';
import '../../i18n/i18n';
import Toggle from '../../shared/components/Toggle/Toggle';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';

import defaultConfig from '../../witty.config.json';
import '../styles.scss';
import {
  createUrl,
  getBaseUrls,
  setBaseUrls,
  setToken,
} from '../../shared/ApiServices/requests';
import PopupHeader from '../PopupComponents/PopupHeader';
import { sendErrorToSentry } from '../../shared/errorUtils';
import { logTypes, useLog } from '../../shared/customHooks/useLog';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';
import PopupHeaderNotification from '../PopupComponents/PopupHeaderNotification';
import { useAuthEndpoint } from '../../shared/ApiServices/useAuthEndpoint';
import { updateConfig } from '../../ContentScript/utils';

interface PopupProps {
  appId: string;
  domain: string;
  isLocked: boolean;
}

const Popup: React.FC<PopupProps> = ({
  appId,
  domain,
  isLocked,
}: PopupProps) => {
  if (TESTING) domain = 'platformsh.site';
  const { t } = useTranslation([namespaces.pages.popup]);
  const analytics = useAnalytics();
  const domainExists = domain && domain.length > 0;

  const log = useLog('Popup');
  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  const [enabled, setEnabled] = useState<EnableWittyToggle>({
    enabled: true,
    updateDashboard: false,
  } as EnableWittyToggle);
  const [initialDomainsDisabledLocally, setInitialDomainsDisabledLocally] = useState<string[]>([]);
  const [orthography, setOrthography] = useState<ConfigProperty>(defaultConfig.ORTHOGRAPHY);
  const [updatingDashboardFailed, setUpdatingDashboardFailed] = useState<boolean>(false);
  const [numberOfNotifications, setNumberOfNotifications] = useState<number>(-1);
  const [accessToken, setAccessToken] = useState<string>('');
  const [authResponse, authErrorResponse, setConfig] = useAuthEndpoint();
  const [hasWittyTeams, setHasWittyTeams] = useState<boolean>(true);
  const [teamName, setTeamName] = useState<string>('');
  const [iFrameDomains, setIFrameDomains] = useState<string[]>([]);

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        setAccessToken(
          result[StorageKeys.ACCESS_TOKEN]
            ? result[StorageKeys.ACCESS_TOKEN]
            : ''
        );
        setIFrameDomains(result[StorageKeys.IFRAME_DOMAINS]);
        setEnabled({
          enabled: 
            !defaultConfig.DISABLED_SITES.includes(domain) &&
            result[StorageKeys.ACCESS_TOKEN] &&
            !result[StorageKeys.DOMAINS].includes(domain) &&
            !isLocked,
          updateDashboard: false,
        });

        if (result[StorageKeys.NUMBER_OF_NOTIFICATIONS] > 0) {
          addNotificationBadge(result[StorageKeys.NUMBER_OF_NOTIFICATIONS]);
          setNumberOfNotifications(result[StorageKeys.NUMBER_OF_NOTIFICATIONS]);
        }

        setOrthography(result[StorageKeys.ORTHOGRAPHY]);

        setInitialDomainsDisabledLocally(result[StorageKeys.DOMAINS]);
        setTeamName(result[StorageKeys.TEAM_NAME]);
      })
      .catch(onStorageError);
  }, []);

  useEffect(() => {
    if(!domain) return;
    if (enabled.updateDashboard) {
      handleDomainToUpdate({
        domain: domain,
        enabled: enabled.enabled,
      });
    }
  }, [enabled]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.ORTHOGRAPHY, orthography);
  }, [orthography]);

  useEffect(() => {
    setToken(accessToken);
    setConfig(accessToken !== '');
  }, [accessToken]);

  useEffect(() => {
    if (authResponse) {
      updateConfig(authResponse);
      const domainAllowed =
        (authResponse.domains?.type === 'deny' && authResponse.domains.list.includes(domain)) ||
        (authResponse.domains?.type === 'allow' && !authResponse.domains.list.includes(domain)) ||
        (authResponse.organization_domains?.type === 'deny' && authResponse.organization_domains.list.includes(domain)) ||
        (authResponse.organization_domains?.type === 'allow' && !authResponse.organization_domains.list.includes(domain));
  
      setEnabled({
        enabled: !domainAllowed,
        updateDashboard: false,
      });
    
      setHasWittyTeams(authResponse.plan === 'witty_teams');
      storeInLocalStorage(StorageKeys.PLAN, authResponse.plan);
      authResponse.organization_name && setTeamName(authResponse.organization_name);

      for (let key in authResponse.organization_config) {
        switch (key) {
          case 'orthography':
            if (
              authResponse.organization_config[key].status == 'force' && 
              !authResponse.organization_config[key].value
            ) {
              setOrthography(authResponse.organization_config[key]);
            } else {
              setOrthography({
                ...orthography,
                status: authResponse.organization_config[key].status,
              });
            }
            break;
        }
      }
    }
  }, [authResponse]);

  useEffect(() => {
    DEV_ENV && console.log('authErrorResponse', authErrorResponse);
    // if (authErrorResponse?.status == 403) {
    //   logOut();
    // }
  }, [authErrorResponse]);

  const setWittyIcon = (enabled: boolean) => {
    enabled ? removeBadge() : addBadge('OFF');
  };

  const handleEnable = () => {
    const isEnabled = !enabled.enabled;
    if (isLocked) return;

    const domains = (iFrameDomains ? [domain, ...iFrameDomains] : [domain]).filter((item, index, array) => array.indexOf(item) === index);

    const newDomainsDisabledLocally = (
      isEnabled
        ? initialDomainsDisabledLocally.filter((item) => !domains.includes(item)) //remove domain and iFrame domains
        : [...initialDomainsDisabledLocally, ...domains].filter((item, index, array) => array.indexOf(item) === index) // Add domain and iFrame domains, make sure unique
    ) as string[];

    storeInLocalStorage(StorageKeys.DOMAINS, newDomainsDisabledLocally);

    setWittyIcon(isEnabled);
    setEnabled({ enabled: isEnabled, updateDashboard: true });
  };

  const logOut = () => {
    storeInLocalStorage(StorageKeys.PLAN, '');
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, '');
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, '');
    setToken('');
  }

  const handleClickDashboard = () => {
    analytics.dashboardLog('button_popup');
    window.open(getBaseUrls().dashboard + 'editor', '_blank');
  }

  const handleDomainToUpdate = (domain: any) => {
    fetch(
      createUrl(getBaseUrls().dashboard, `api/user/language/domains?` + new URLSearchParams({ domain: domain.domain }) ),
      {
        method: domain.enabled ? 'DELETE' : 'PUT',
         headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    ).then(async (response) => {
      if (response.status == 403) {
        setUpdatingDashboardFailed(true);
        setEnabled({ enabled: !enabled.enabled, updateDashboard: false });
        setTimeout(() => {
          setUpdatingDashboardFailed(false);
        }, 3000);
        getNewAccessToken();
      }
    });
  };

  return (
    <>
      {numberOfNotifications > 0 ? <PopupHeaderNotification /> : <PopupHeader appId={appId} />}
      <div className='witty-works-ext-section'>
        {domainExists && ( 
          <>
            <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'>
              <div className='witty-works-ext-lato-popup-title'>
                {t('websiteSettings', { domain: domain })}
              </div>
            </div>
            <Toggle
              on={enabled.enabled}
              handleToggle={handleEnable}
              label={
                updatingDashboardFailed
                  ? t('enableWittyFailed')
                  : t('enableWitty')
              }
              locked={isLocked}
            />
            <div className='witty-works-ext-separator' />
          </>
        )}

        <div className='witty-works-ext-left witty-works-ext-margin-top'>
          <button className='witty-works-ext-button witty-works-ext-primary-button-red' onClick={handleClickDashboard}>
            {t('goToDashboard')}
          </button>
        </div>       
      </div>

      {teamName && (
        <div className='witty-works-ext-section'>
          <div className='witty-works-ext-lato-popup-text' style={{ marginTop: hasWittyTeams ? '-0.5em' : 0 }}>
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

export default Popup;