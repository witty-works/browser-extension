import React, { useState, useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';
import { useTranslation } from 'react-i18next';

import {
  ConfigProperty,
  EnableWittyToggle,
  IAuthResponse,
} from '../../shared/types';
import {
  StorageKeys,
  DefaultBaseUrlKey,
  DEV_ENV,
  TESTING,
} from '../../shared/constants';
import {
  addInactiveBadge,
  addLoginBadge,
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
import ThinkingEmoji from '../../assets/icons/popup/thinkingEmoji.svg';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';
import PopupHeaderNotification from '../PopupComponents/PopupHeaderNotification';
import { useAuthEndpoint } from '../../shared/ApiServices/useAuthEndpoint';
import { updateConfig } from '../../ContentScript/utils';

interface PopupProps {
  appId: string;
  domain: string;
  domainOnActiveOrDisabledList: boolean;
  domainIsConfirmedByUser: boolean;
  domainsConfirmedToNotWork: string[];
  domainsConfirmedToWork: string[];
  isLocked: boolean;
}

const Popup: React.FC<PopupProps> = ({
  appId,
  domain,
  domainOnActiveOrDisabledList,
  domainIsConfirmedByUser,
  domainsConfirmedToNotWork,
  domainsConfirmedToWork,
  isLocked,
}: PopupProps) => {
  if (TESTING) domain = 'platformsh.site';
  const { t } = useTranslation([namespaces.pages.popup]);
  const [enabled, setEnabled] = useState<EnableWittyToggle>({
    enabled: true,
    updateDashboard: false,
  } as EnableWittyToggle);
  const [domainsDisabledLocally, setDomainsDisabledLocally] = useState<
    string[]
  >([]);
  const [orthography, setOrthography] = useState<ConfigProperty>(
    defaultConfig.ORTHOGRAPHY
  );
  const [updatingDashboardFailed, setUpdatingDashboardFailed] =
    useState<boolean>(false);
  const [casing, setCasing] = useState<boolean>(true);
  const [casingSites, setCasingSites] = useState<string[]>(
    defaultConfig.CASING_SITES
  );
  const [showSurvey, setShowSurvey] = useState<boolean>(false);
  const [surveyResponse, setSurveyResponse] = useState<string>('');
  const [numberOfNotifications, setNumberOfNotifications] =
    useState<number>(-1);
  const [accessToken, setAccessToken] = useState<string>('');
  const [userIsLoggedIn, setUserIsLoggedIn] = useState<boolean>(false);
  const [domainIsSetAsNotWorking, setDomainIsSetToNotWorking] =
    useState<boolean>(
      domainsConfirmedToNotWork
        .map((d: string) => d.split('-')[0])
        .includes(domain)
    );
  const [resetSettings, setResetSettings] = useState<boolean>(false);
  const log = useLog('Popup');
  const analytics = useAnalytics();
  const [authResponse, authErrorResponse, setConfig] = useAuthEndpoint();
  const [localConfigDiffersFromDashboard, setLocalConfigDiffersFromDashboard] =
    useState<boolean>(false);
  const onStorageError = (error: unknown) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };
  const [authResponseConfig, setAuthResponseConfig] =
    useState<IAuthResponse | null>(null);
  const [hasWittyTeams, setHasWittyTeams] = useState<boolean>(true);
  const [teamName, setTeamName] = useState<string>('');
  const domainExists = domain && domain.length > 0;

  useEffect(() => {
    !domainOnActiveOrDisabledList && !domainIsConfirmedByUser && domainExists
      ? setShowSurvey(true)
      : setShowSurvey(false);

    browser.storage.local
      .get(null)
      .then((result) => {
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
        setUserIsLoggedIn(result[StorageKeys.ACCESS_TOKEN] ? true : false);
        setAccessToken(
          result[StorageKeys.ACCESS_TOKEN]
            ? result[StorageKeys.ACCESS_TOKEN]
            : ''
        );
        setEnabled({
          enabled:
            !domainsConfirmedToNotWork
              .map((d: string) => {
                return d.split('-')[0];
              })
              .includes(domain) &&
            !defaultConfig.DISABLED_SITES.includes(domain) &&
            result[StorageKeys.ACCESS_TOKEN] &&
            !result[StorageKeys.DOMAINS].includes(domain) &&
            !isLocked
              ? true
              : false,
          updateDashboard: false,
        });
        setCasingSites(result[StorageKeys.CASING_SITES]);
        result[StorageKeys.CASING_SITES] &&
          result[StorageKeys.CASING_SITES].includes(domain) &&
          setCasing(false);

        if (result[StorageKeys.NUMBER_OF_NOTIFICATIONS] > 0) {
          addNotificationBadge(result[StorageKeys.NUMBER_OF_NOTIFICATIONS]);
          setNumberOfNotifications(result[StorageKeys.NUMBER_OF_NOTIFICATIONS]);
        }

        setOrthography(result[StorageKeys.ORTHOGRAPHY]);

        setDomainsDisabledLocally(result[StorageKeys.DOMAINS]);
        setTeamName(result[StorageKeys.TEAM_NAME]);
      })

      .catch(onStorageError);
  }, []);

  useEffect(() => {
    const domainWithTimeStamp = `${domain}-${new Date().getTime()}`;

    if (surveyResponse == 'yes') {
      //remove it from the 'not working' list before adding it to the 'working' list
      domainsConfirmedToNotWork &&
        domainsConfirmedToNotWork
          .map((d) => d.split('-')[0])
          .includes(domain) &&
        storeInLocalStorage(
          StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK,
          domainsConfirmedToNotWork.filter((d) => d.split('-')[0] !== domain)
        );

      storeInLocalStorage(StorageKeys.DOMAINS_CONFIRMED_TO_WORK, [
        ...domainsConfirmedToWork,
        domainWithTimeStamp,
      ]);
    } else if (surveyResponse == 'no') {
      domainsConfirmedToWork &&
        domainsConfirmedToWork.map((d) => d.split('-')[0]).includes(domain) &&
        storeInLocalStorage(
          StorageKeys.DOMAINS_CONFIRMED_TO_WORK,
          domainsConfirmedToWork.filter((d) => d.split('-')[0] !== domain)
        );

      storeInLocalStorage(StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK, [
        ...domainsConfirmedToNotWork,
        domainWithTimeStamp,
      ]);
    }
  }, [surveyResponse]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.CASING_SITES, casingSites);
  }, [casingSites.length]);

  useEffect(() => {
    if (domain) {
      if (enabled.updateDashboard) {
        handleDomainToUpdate({
          domain: domain,
          enabled: enabled.enabled,
        });
      }

      !enabled &&
        storeInLocalStorage(StorageKeys.DOMAINS, [
          ...domainsDisabledLocally,
          domain,
        ]);
    }
    setWittyIcon(enabled.enabled);
  }, [enabled]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.ORTHOGRAPHY, orthography);
  }, [orthography]);

  useEffect(() => {
    setToken(accessToken);
    setConfig(accessToken != '' ? true : false);
  }, [accessToken]);

  useEffect(() => {
    if (authResponse) {
      updateConfig(authResponse);

      if (
        authResponse.domains.list.includes(domain) ||
        (authResponse.organization_domains &&
          authResponse.organization_domains.list.includes(domain))
      ) {
        setEnabled({
          enabled: false,
          updateDashboard: false,
        });
      } else {
        setEnabled({
          enabled: true,
          updateDashboard: false,
        });
      }
      
      setAuthResponseConfig(authResponse);
      setHasWittyTeams(authResponse.plan === 'witty_teams' ? true : false);
      storeInLocalStorage(StorageKeys.PLAN, authResponse.plan);
      authResponse.organization_name &&
        setTeamName(authResponse.organization_name);
      for (let key in authResponse.organization_config) {
        switch (key) {
          case 'orthography':
            if (
              (authResponse.organization_config[key].status == 'force' && !authResponse.organization_config[key].value && localConfigDiffersFromDashboard) ||
              resetSettings
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
      setResetSettings(false);
    }
  }, [authResponse, resetSettings]);

  useEffect(() => {
    if (!authResponseConfig?.organization_config) return;
    if (
      authResponseConfig.organization_config['orthography'].value !=
        orthography.value
    ) {
      setLocalConfigDiffersFromDashboard(true);
    } else {
      setLocalConfigDiffersFromDashboard(false);
    }
  }, [authResponseConfig, orthography]);

  useEffect(() => {
    DEV_ENV && console.log('authErrorResponse', authErrorResponse);
    // if (authErrorResponse?.status == 403) {
    //   logOut();
    // }
  }, [authErrorResponse]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.DOMAINS, domainsDisabledLocally);
  }, [domainsDisabledLocally.length]);

  const setWittyIcon = (state: boolean) => {
    state ? removeBadge() : addInactiveBadge();
  };

  const handleEnableToggle = () => {
    if (isLocked) return;

    if (domainIsSetAsNotWorking && !enabled.enabled) {
      setDomainIsSetToNotWorking(false);
      setShowSurvey(true);
      storeInLocalStorage(
        StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK,
        domainsConfirmedToNotWork.filter((d) => d.split('-')[0] !== domain)
      );
    }

    setEnabled({ enabled: !enabled.enabled, updateDashboard: true });

    if (domainExists)
      setDomainsDisabledLocally(
        enabled.enabled
          ? [...domainsDisabledLocally, domain]
          : domainsDisabledLocally.filter((item: string) => item !== domain)
      );
  };

  const handleCasingToggle = () => {
    setCasing(!casing);

    if (domainExists)
      setCasingSites(
        casing
          ? [...casingSites, domain]
          : casingSites.filter((item: string) => item !== domain)
      );
  };

  function logOut() {
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, '');
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, '');
    setToken('');
    setUserIsLoggedIn(false);
    addLoginBadge();
  }

  function handleClickSurveyResponseYes() {
    setSurveyResponse('yes');
    setShowSurvey(false);
    analytics.urlLog(domain, 'wittyWorksAsExpected');
  }

  function handleClickSurveyResponseNo() {
    setSurveyResponse('no');
    setEnabled({ enabled: false, updateDashboard: false });
    setSurveyResponse('');
    setDomainIsSetToNotWorking(true);
    analytics.urlLog(domain, 'wittyDoesNotWorkAsExpected');
  }

  function handleClickDashboard() {
    analytics.dashboardLog('button_popup');
    window.open(getBaseUrls().dashboard + 'editor', '_blank');
  }

  const handleDomainToUpdate = (domain: any) => {
    browser.storage.local.get().then((result) => {
      if (
        result[StorageKeys.ACCESS_TOKEN] 
      ) {
        fetch(
          createUrl(getBaseUrls().dashboard,
            `api/user/language/domains?` +
              new URLSearchParams({
                domain: domain.domain,
              })
          ),
          {
            method: domain.enabled ? 'DELETE' : 'PUT',
            headers: {
              Authorization: `Bearer ${result[StorageKeys.ACCESS_TOKEN]}`,
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
      }
    });
  };

  return (
    <>
      {numberOfNotifications > 0 ? (
        <PopupHeaderNotification />
      ) : (
        <PopupHeader appId={appId} />
      )}
      <div className='witty-works-ext-section'>
        {domainExists && ( 
          <>
            <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'>
              <div className='witty-works-ext-lato-popup-title'>
                {domainIsSetAsNotWorking
                  ? t('websiteSettingsDeactivated', { domain: domain })
                  : t('websiteSettings', { domain: domain })}
              </div>
            </div>
            <Toggle
              on={enabled.enabled}
              handleToggle={handleEnableToggle}
              label={
                domainIsSetAsNotWorking
                  ? t('tryAgainOnThisWebsite')
                  : updatingDashboardFailed
                  ? t('enableWittyFailed')
                  : t('enableWitty')
              }
              locked={isLocked}
            />
            {enabled.enabled && !showSurvey && (
              <>
                <Toggle
                  on={casing}
                  handleToggle={handleCasingToggle}
                  label={t('caseSensitivity')}
                />
              </>
            )}
            <div className='witty-works-ext-separator' />
          </>
        )}

        {enabled.enabled && (!showSurvey || TESTING) && (
          <div className='witty-works-ext-margin-top'>
            <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'>
              <div className='witty-works-ext-lato-popup-title'>
                {t('globalSettings')}
              </div>
            </div>
            <Toggle
              on={orthography.value as boolean}
              handleToggle={() => {
                setOrthography({
                  ...orthography,
                  value:
                    orthography.status === 'force'  && orthography.value == true && !localConfigDiffersFromDashboard
                      ? orthography.value
                      : !orthography.value,
                });
              }}
              label={t('spellChecking')}
              locked={orthography.status === 'force' && orthography.value == true && !localConfigDiffersFromDashboard}
              userIsLoggedIn={userIsLoggedIn}
            />
       
            {localConfigDiffersFromDashboard && (
              <div className='witty-works-ext-wittyworks-container witty-works-ext-left'>
                <div
                  className='witty-works-ext-button witty-works-ext-secondary-button-red'
                  onClick={() => {
                    setResetSettings(true);
                  }}
                >
                  {t('resetSettings')}
                </div>
              </div>
            )}
            {
              <div className='witty-works-ext-left'>
                <div
                  className='witty-works-ext-button witty-works-ext-primary-button-red'
                  onClick={handleClickDashboard}
                >
                  {t('goToDashboard')}
                </div>
              </div>
            }
          </div>
        )}
      </div>
      {showSurvey && enabled.enabled && (
        <div className='witty-works-ext-wittyworks-container witty-works-ext-full-padding witty-works-ext-light-gray-background witty-works-ext-left'>
          <div className='witty-works-ext-container-row witty-works-ext-justify-start'>
            <div className='witty-works-ext-margin-right'>
              <ThinkingEmoji />
            </div>
            <div className='witty-works-ext-lato-small-paragraph-title-h4'>
              {t('doesWittyWork')}
            </div>
          </div>
          {surveyResponse === '' && (
            <div className='witty-works-ext-lato-popup-text witty-works-ext-margin-top'>
              {t('doesWittyWorkExplanation')}
            </div>
          )}
          {!surveyResponse && (
            <div className='witty-works-ext-container-row witty-works-ext-justify-start witty-works-ext-margin-top'>
              <div
                className='witty-works-ext-button witty-works-ext-primary-button-red'
                onClick={handleClickSurveyResponseYes}
              >
                {t('surveyButtonYes')}
              </div>
              <div
                className='witty-works-ext-button witty-works-ext-secondary-button-red'
                onClick={handleClickSurveyResponseNo}
              >
                {t('surveyButtonNo')}
              </div>
            </div>
          )}
        </div>
      )}

      {teamName && (
        <div className='witty-works-ext-section'>
          <div
            className='witty-works-ext-lato-popup-text'
            style={{
              marginTop:
                localConfigDiffersFromDashboard || hasWittyTeams ? '-0.5em' : 0,
            }}
          >
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
            <div
              className='witty-works-ext-button witty-works-ext-primary-button-red'
              onClick={logOut}
            >
              {t('signOut')}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Popup;
