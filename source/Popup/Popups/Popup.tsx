import React, {useState, useEffect} from 'react';
import browser from 'webextension-polyfill';
import {useTranslation} from 'react-i18next';

import {EnableWittyToggle} from '../../shared/types';
import {
  apiKeyFromStorage,
  isDashboardAvailable,
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  TESTING,
  X_KEY,
  registerCustomEndpointFromStorage,
} from '../../shared/constants';
import {
  addBadge,
  addNotificationBadge,
  getNewAccessToken,
  removeBadge,
  storeInLocalStorage,
  updateConfig,
  isSignedInResult,
} from '../../shared/utils';
import {namespaces} from '../../i18n/i18n.constants';
import Toggle from '../../shared/components/Toggle/Toggle';
import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents/DelaySelector';

import defaultConfig from '../../witty.config.json';
import '../styles.scss';
import {
  createUrl,
  getBaseUrls,
  setApiKey,
  setBaseUrls,
  setToken,
  buildRequestHeaders,
} from '../../shared/ApiServices/requests';
import PopupHeader from '../PopupComponents/PopupHeader';
import OptionsLink from '../PopupComponents/OptionsLink';
import {sendErrorToSentry} from '../../shared/errorUtils';
import {logTypes, useLog} from '../../shared/customHooks/useLog';
import {useAnalytics} from '../../shared/ApiServices/useAnalytics';
import PopupHeaderNotification from '../PopupComponents/PopupHeaderNotification';
import {useAuthEndpoint} from '../../shared/ApiServices/useAuthEndpoint';
import {clearTokens, readAccessToken} from '../../shared/tokenStore';

interface PopupProps {
  appId: string;
  domain: string;
  isLocked: boolean;
}

const Popup: React.FC<PopupProps> = ({appId, domain, isLocked}: PopupProps) => {
  if (TESTING) domain = 'platformsh.site';
  const {t} = useTranslation([namespaces.pages.popup]);
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
  const [initialDomainsDisabledLocally, setInitialDomainsDisabledLocally] =
    useState<string[]>([]);
  const [updatingDashboardFailed, setUpdatingDashboardFailed] =
    useState<boolean>(false);
  const [numberOfNotifications, setNumberOfNotifications] =
    useState<number>(-1);
  const [accessToken, setAccessToken] = useState<string>('');
  const [authResponse, authErrorResponse, setConfig] = useAuthEndpoint();
  const [teamName, setTeamName] = useState<string>('');
  const [iFrameDomains, setIFrameDomains] = useState<string[]>([]);
  const [hrFeatures, setHrFeatures] = useState<boolean>(true);
  // False in API-key mode: there is no dashboard to link to or sync with.
  const [dashboardAvailable, setDashboardAvailable] = useState<boolean>(true);
  const [hrFeaturesDisabledDomains, setHrFeaturesDisabledDomains] = useState<
    string[]
  >([]);

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        registerCustomEndpointFromStorage(result);
        setApiKey(apiKeyFromStorage(result));
        setDashboardAvailable(isDashboardAvailable(result));
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        // The access token lives in storage.session now, so it is not part of
        // this storage.local snapshot.
        readAccessToken().then(setAccessToken).catch(onStorageError);

        setIFrameDomains(result[StorageKeys.IFRAME_DOMAINS] || []);
        setEnabled({
          enabled:
            !defaultConfig.DISABLED_SITES.includes(domain) &&
            isSignedInResult(result) &&
            !result[StorageKeys.DOMAINS].includes(domain) &&
            !isLocked,
          updateDashboard: false,
        });

        if (result[StorageKeys.NUMBER_OF_NOTIFICATIONS] > 0) {
          addNotificationBadge(result[StorageKeys.NUMBER_OF_NOTIFICATIONS]);
          setNumberOfNotifications(result[StorageKeys.NUMBER_OF_NOTIFICATIONS]);
        }

        setInitialDomainsDisabledLocally(result[StorageKeys.DOMAINS] || []);
        setTeamName(result[StorageKeys.TEAM_NAME]);
        setHrFeaturesDisabledDomains(
          result[StorageKeys.HR_FEATURES_DISABLED_DOMAINS] || []
        );
        if (
          result[StorageKeys.HR_FEATURES_DISABLED_DOMAINS]?.includes(domain)
        ) {
          setHrFeatures(false);
        }
      })
      .catch(onStorageError);
  }, []);

  useEffect(() => {
    if (!domain) return;
    if (enabled.updateDashboard) {
      // Sync the dashboard for the top-level domain *and* every iframe
      // domain Witty was toggled for locally. Sites like Hubspot render
      // their editor inside an iframe served from a different domain than
      // the tab itself, so the top-level domain alone is not what the
      // editor is checked against. Skipping the iframe domains here left
      // the dashboard's disabled-domains list out of sync with what
      // handleEnable had just written to local storage, so Witty's
      // highlights kept reappearing in the iframe after a reload even
      // though the toggle showed "disabled" (#1388).
      const domainsToUpdate = [domain, ...iFrameDomains].filter(
        (item, index, array) => !!item && array.indexOf(item) === index
      );

      domainsToUpdate.forEach((domainToUpdate) => {
        handleDomainToUpdate({
          domain: domainToUpdate,
          enabled: enabled.enabled,
        });
      });
    }
  }, [enabled]);

  useEffect(() => {
    setToken(accessToken);
    // Ensure auth endpoint runs for X_KEY-based auth as well
    setConfig(!!(accessToken || X_KEY));
  }, [accessToken]);

  useEffect(() => {
    if (authResponse) {
      updateConfig(authResponse);
      const domainAllowed =
        (authResponse.domains?.type === 'deny' &&
          authResponse.domains.list.includes(domain)) ||
        (authResponse.domains?.type === 'allow' &&
          !authResponse.domains.list.includes(domain)) ||
        (authResponse.organization_domains?.type === 'deny' &&
          authResponse.organization_domains.list.includes(domain)) ||
        (authResponse.organization_domains?.type === 'allow' &&
          !authResponse.organization_domains.list.includes(domain));

      setEnabled({
        enabled: !domainAllowed,
        updateDashboard: false,
      });
      authResponse.organization_name &&
        setTeamName(authResponse.organization_name);
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

    const domains = [domain, ...iFrameDomains].filter(
      (item, index, array) => array.indexOf(item) === index
    );

    const newDomainsDisabledLocally = (
      isEnabled
        ? initialDomainsDisabledLocally.filter(
            (item) => !domains.includes(item)
          ) //remove domain and iFrame domains
        : [...initialDomainsDisabledLocally, ...domains].filter(
            (item, index, array) => array.indexOf(item) === index
          )
    ) as string[]; // Add domain and iFrame domains, make sure unique

    storeInLocalStorage(StorageKeys.DOMAINS, newDomainsDisabledLocally);

    setWittyIcon(isEnabled);
    setEnabled({enabled: isEnabled, updateDashboard: true});
  };

  const handleHrFeatures = () => {
    const newHrFeaturesDisabledDomains = hrFeatures
      ? [...hrFeaturesDisabledDomains, domain]
      : hrFeaturesDisabledDomains.filter((item) => item !== domain);
    storeInLocalStorage(
      StorageKeys.HR_FEATURES_DISABLED_DOMAINS,
      newHrFeaturesDisabledDomains
    );
    setHrFeatures(!hrFeatures);
  };

  const logOut = () => {
    clearTokens().catch(onStorageError);
    setToken('');
  };

  const handleClickDashboard = () => {
    analytics.dashboardLog('button_popup');
    window.open(getBaseUrls().dashboard + 'editor', '_blank');
  };

  const handleDomainToUpdate = (domain: any) => {
    // Without a dashboard the domain list stays local — StorageKeys.DOMAINS is
    // already written by handleEnable. Returning early also stops the API key
    // being sent to a host that does not exist.
    if (!dashboardAvailable) {
      return;
    }

    const headers = buildRequestHeaders(accessToken);

    fetch(
      createUrl(
        getBaseUrls().dashboard,
        `api/user/language/domains?` +
          new URLSearchParams({domain: domain.domain})
      ),
      {
        method: domain.enabled ? 'DELETE' : 'PUT',
        headers,
      }
    ).then(async (response) => {
      if (response.status === 403) {
        setUpdatingDashboardFailed(true);
        setEnabled({enabled: !enabled.enabled, updateDashboard: false});
        browser.alarms.create('resetUpdatingDashboardFailedAlarm', {
          delayInMinutes: 3 / 60,
        }); // 3000 ms in minutes
        browser.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name === 'resetUpdatingDashboardFailedAlarm') {
            setUpdatingDashboardFailed(false);
          }
        });

        getNewAccessToken();
      }
    });
  };

  return (
    <>
      {numberOfNotifications > 0 ? (
        <PopupHeaderNotification />
      ) : (
        <PopupHeader appId={appId} showSettings={dashboardAvailable} />
      )}
      {X_KEY && authErrorResponse && (
        <div className='witty-works-ext-section'>
          <div
            className='witty-works-ext-lato-popover-text'
            style={{color: '#E6635A'}}
          >
            {t('apiKeyAuthFailed', {
              status: authErrorResponse.status,
              message: authErrorResponse.message,
            })}
          </div>
        </div>
      )}
      <div className='witty-works-ext-section'>
        {domainExists && (
          <>
            <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'>
              <div className='witty-works-ext-lato-popup-title'>
                {t('websiteSettings', {domain: domain})}
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

            <Toggle
              on={hrFeatures}
              handleToggle={handleHrFeatures}
              label={t('hrFeatures')}
              hrFeatureToggle={true}
            />
            <div className='witty-works-ext-separator' />
          </>
        )}

        {dashboardAvailable && (
          <div className='witty-works-ext-left witty-works-ext-margin-top'>
            <button
              className='witty-works-ext-button witty-works-ext-primary-button-red'
              onClick={handleClickDashboard}
            >
              {t('goToDashboard')}
            </button>
          </div>
        )}
      </div>

      {teamName && (
        <div className='witty-works-ext-section'>
          <div
            className='witty-works-ext-lato-popup-text'
            style={{marginTop: '-0.5em'}}
          >
            {t('loggedInTo') + ' "' + teamName + '"'}
          </div>
        </div>
      )}

      <OptionsLink />
      {DEV_ENV && (
        <div className='witty-works-ext-section'>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
          <div className='witty-works-ext-left'>
            <button
              className='witty-works-ext-button witty-works-ext-primary-button-red'
              onClick={logOut}
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Popup;
