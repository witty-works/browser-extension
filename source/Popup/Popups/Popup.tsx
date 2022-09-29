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
} from '../../shared/constants';
import {
  addInactiveBadge,
  addLoginBadge,
  addNotificationBadge,
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
  const [inclusiveLanguage, setInclusiveLanguage] = useState<ConfigProperty>(
    defaultConfig.INCLUSIVE
  );
  const [styleCorrections, setStyleCorrections] = useState<ConfigProperty>(
    defaultConfig.STYLE
  );
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
        setInclusiveLanguage(result[StorageKeys.INCLUSIVE]);
        setStyleCorrections(result[StorageKeys.STYLE]);

        setDomainsDisabledLocally(result[StorageKeys.DOMAINS]);
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
      enabled.updateDashboard &&
        storeInLocalStorage(StorageKeys.DOMAIN_TO_UPDATE, {
          domain: domain,
          enabled: enabled.enabled,
        });

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
    storeInLocalStorage(StorageKeys.INCLUSIVE, inclusiveLanguage);
  }, [inclusiveLanguage]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.STYLE, styleCorrections);
  }, [styleCorrections]);

  useEffect(() => {
    setToken(accessToken);
    setConfig(accessToken != '' ? true : false);
  }, [accessToken]);

  useEffect(() => {
    if (authResponse) {
      setAuthResponseConfig(authResponse);
      setHasWittyTeams(authResponse.plan === 'witty_teams' ? true : false);
      storeInLocalStorage(StorageKeys.PLAN, authResponse.plan);
      for (let key in authResponse.organization_config) {
        switch (key) {
          case 'orthography':
            if (
              authResponse.organization_config[key].status == 'force' ||
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
          case 'inclusive':
            if (
              authResponse.organization_config[key].status == 'force' ||
              resetSettings
            ) {
              setInclusiveLanguage(authResponse.organization_config[key]);
            } else {
              setInclusiveLanguage({
                ...inclusiveLanguage,
                status: authResponse.organization_config[key].status,
              });
            }
            break;
          case 'style':
            if (
              authResponse.organization_config[key].status == 'force' ||
              resetSettings
            ) {
              setStyleCorrections(authResponse.organization_config[key]);
            } else {
              setStyleCorrections({
                ...styleCorrections,
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
        orthography.value ||
      authResponseConfig.organization_config['inclusive'].value !=
        inclusiveLanguage.value ||
      authResponseConfig.organization_config['style'].value !=
        styleCorrections.value
    ) {
      setLocalConfigDiffersFromDashboard(true);
    } else {
      setLocalConfigDiffersFromDashboard(false);
    }
  }, [authResponseConfig, orthography, inclusiveLanguage, styleCorrections]);

  useEffect(() => {
    console.log('authErrorResponse', authErrorResponse);
    // if (authErrorResponse?.status == 403) {
    //   logOut();
    // }
  }, [authErrorResponse]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.DOMAINS, domainsDisabledLocally);
  }, [domainsDisabledLocally.length]);

  const setWittyIcon = (state: boolean) => {
    removeBadge();
    !state && addInactiveBadge();
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

  const logOut = () => {
    browser.storage.local.set({ [StorageKeys.ACCESS_TOKEN]: '' });
    setToken('');
    setUserIsLoggedIn(false);
    addLoginBadge();
  };

  return (
    <>
      {numberOfNotifications > 0 ? (
        <PopupHeaderNotification />
      ) : (
        <PopupHeader />
      )}
      <section>
        {domainExists && (
          <>
            <div className='container container-row justify-space-between'>
              <div className='lato-popup-title'>
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
          </>
        )}

        {enabled.enabled && !showSurvey && (
          <>
            <div className='separator' />
            <div className='container container-row justify-space-between'>
              <div className='lato-popup-title'>{t('globalSettings')}</div>
            </div>
            <Toggle
              on={orthography.value as boolean}
              handleToggle={() => {
                setOrthography({
                  ...orthography,
                  value:
                    orthography.status != 'force' || !userIsLoggedIn
                      ? !orthography.value
                      : orthography.value,
                });
              }}
              label={t('spellChecking')}
              locked={orthography.status == 'force'}
              userIsLoggedIn={userIsLoggedIn}
            />

            <Toggle
              on={inclusiveLanguage.value as boolean}
              handleToggle={() => {
                setInclusiveLanguage({
                  ...inclusiveLanguage,
                  value:
                    inclusiveLanguage.status != 'force' || !userIsLoggedIn
                      ? !inclusiveLanguage.value
                      : inclusiveLanguage.value,
                });
              }}
              label={t('inclusiveTerms')}
              locked={inclusiveLanguage.status === 'force'}
              userIsLoggedIn={userIsLoggedIn}
            />
            <Toggle
              on={styleCorrections.value as boolean}
              handleToggle={() => {
                setStyleCorrections({
                  ...styleCorrections,
                  value:
                    styleCorrections.status != 'force' || !userIsLoggedIn
                      ? !styleCorrections.value
                      : styleCorrections.value,
                });
              }}
              label={t('styleCorrections')}
              locked={styleCorrections.status == 'force'}
              userIsLoggedIn={userIsLoggedIn}
            />
            {localConfigDiffersFromDashboard && (
              <div className='container left'>
                <div
                  className='button secondary-button-purple'
                  onClick={() => {
                    setResetSettings(true);
                  }}
                >
                  {t('resetSettings')}
                </div>
              </div>
            )}
            {hasWittyTeams && (
              <div className='left'>
                <div
                  className='button primary-button-purple'
                  onClick={() => {
                    window.open(getBaseUrls().dashboard, '_blank');
                  }}
                >
                  {t('goToDashboard')}
                </div>
              </div>
            )}
          </>
        )}
      </section>
      {!hasWittyTeams && !showSurvey && (
        <div className='container full-padding light-gray-background left'>
          <div className='lato-popup-title'>
            {t('getMoreTitle', { domain: 'miro.com' })}
          </div>
          <div className='lato-popup-text'>{t('getMoreText')}</div>
          <div
            className='button primary-button-purple'
            onClick={() => {
              window.open(
                'https://www.witty.works/witty-for-teams',
                '_blank',
                'noopener'
              );
            }}
          >
            {t('learnMoreButton')}
          </div>
        </div>
      )}
      {showSurvey && enabled.enabled && (
        <div className='container full-padding light-gray-background left'>
          <div className='container-row justify-start'>
            <div className='margin-right'>
              <ThinkingEmoji />
            </div>
            <div className='lato-small-paragraph-title-h4'>
              {t('doesWittyWork')}
            </div>
          </div>
          {surveyResponse === '' && (
            <div className='lato-popup-text'>
              {t('doesWittyWorkExplanation')}
            </div>
          )}
          {!surveyResponse && (
            <div className='container-row justify-start'>
              <div
                className='button primary-button-purple'
                onClick={() => {
                  setSurveyResponse('yes');
                  setShowSurvey(false);
                  analytics.urlLog(domain, appId, 'wittyWorksAsExpected');
                }}
              >
                {t('surveyButtonYes')}
              </div>
              <div
                className='button secondary-button-purple'
                onClick={() => {
                  setSurveyResponse('no');
                  setEnabled({ enabled: false, updateDashboard: false });
                  setSurveyResponse('');
                  setDomainIsSetToNotWorking(true);
                  analytics.urlLog(domain, appId, 'wittyDoesNotWorkAsExpected');
                }}
              >
                {t('surveyButtonNo')}
              </div>
            </div>
          )}
        </div>
      )}
      {DEV_ENV && (
        <section>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
          <div className='left'>
            <div
              className='button primary-button-purple'
              onClick={() => {
                logOut();
              }}
            >
              {t('signOut')}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default Popup;
