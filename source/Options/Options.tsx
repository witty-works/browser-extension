import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import defaultConfig from '../witty.config.json';
import { ConfigProperty } from '../shared/types';
import { useAuthEndpoint } from '../shared/ApiServices/useAuthEndpoint';
import { DefaultBaseUrlKey, Colors, StorageKeys } from '../shared/constants';
import {
  storeInLocalStorage,
  singularTheyToBoolean,
  changeSingularThey,
  maximumImportanceToBoolean,
  changeMaximumImportance,
} from '../shared/utils';
// import LanguageSelector from '../Popup/LanguageSelector';
import GermanGenderEndSelector from '../Popup/GermanGenderEndSelector';
import PreferedLanguagesSelector from '../Popup/PreferedLanguagesSelector';
import WittyLogo from '../assets/icons/options/witty-logo.svg';
import ArrowDown from '../assets/icons/options/arrow-down.svg';
import ArrowUp from '../assets/icons/options/arrow-up.svg';
import Bin from '../assets/icons/options/bin.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';
import Toggle from '../shared/components/Toggle/Toggle';
import './styles.scss';
import { setBaseURL, setToken } from '../shared/ApiServices/requests';
import GenderRoleFormatSelector from '../Popup/GenderRoleFormatSelector';

const Options: React.FC = () => {
  const { t } = useTranslation([
    namespaces.pages.options,
    namespaces.pages.popup,
  ]);
  // const [languagesTabOpen, setLanguagesTabOpen] = useState<boolean>(false);
  const [rulesTabOpen, setRulesTabOpen] = useState<boolean>(false);
  const [disableTabOpen, setDisableTabOpen] = useState<boolean>(false);
  const [disabledSites, setDisabledSites] = useState<string[]>([]);
  const [addDomainTabOpen, setAddDomainTabOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [invalidDomain, setInvalidDomain] = useState<boolean>(false);
  const [inclusiveLanguage, setInclusiveLanguage] = useState<ConfigProperty>(
    defaultConfig.INCLUSIVE
  );
  const [styleCorrections, setStyleCorrections] = useState<ConfigProperty>(
    defaultConfig.STYLE
  );
  const [maximumImportance, setMaximumImportance] = useState<ConfigProperty>(
    defaultConfig.MAXIMUM_IMPORTANCE
  );
  const [orthography, setOrthography] = useState<ConfigProperty>(
    defaultConfig.ORTHOGRAPHY
  );
  const [inspirationalAlternatives, setInspirationalAlternatives] =
    useState<ConfigProperty>(defaultConfig.SHOW_INSPIRATION_ALTERNATIVES);
  const [singularThey, setSingularThey] = useState<ConfigProperty>(
    defaultConfig.SINGULAR_THEY
  );
  const [genderRolesFormat, setGenderRolesFormat] = useState<ConfigProperty>(
    defaultConfig.GENDERED_ROLES_FORMAT
  );
  const [teamName, setTeamName] = useState<string>('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('');

  const [username, setUsername] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [authResponse, authErrorResponse, getConfig] = useAuthEndpoint();

  const baseUrl = 'https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site';
  const originalOptionsUri = window.location.href;
  const [hasWittyTeams, setHasWittyTeams] = useState<boolean>(false);
  const [userIsLoggedIn, setUserIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    browser.storage.local.get(null).then((result) => {
      //Set the Endpoint url
      setBaseURL(
        result[StorageKeys.API_ENDPOINT_KEY]
          ? result[StorageKeys.API_ENDPOINT_KEY]
          : DefaultBaseUrlKey
      );

      setOrthography(result[StorageKeys.ORTHOGRAPHY]);
      setInclusiveLanguage(result[StorageKeys.INCLUSIVE]);
      setStyleCorrections(result[StorageKeys.STYLE]);
      setMaximumImportance(result[StorageKeys.MAXIMUM_IMPORTANCE]);
      setSingularThey(result[StorageKeys.SINGULAR_THEY]);
      setInspirationalAlternatives(
        result[StorageKeys.SHOW_INSPIRATION_ALTERNATIVES]
      );
      setDisabledSites(result[StorageKeys.DISABLED_SITES]);
      setUsername(result[StorageKeys.USERNAME]);
      setAccessToken(result[StorageKeys.ACCESS_TOKEN]);
      setRefreshToken(result[StorageKeys.REFRESH_TOKEN]);
      setGenderRolesFormat(result[StorageKeys.GENDERED_ROLES_FORMAT]);
      setTeamName(result[StorageKeys.NAME]);
      setSubscriptionPlan(result[StorageKeys.PLAN]);

      result[StorageKeys.ACCESS_TOKEN] == ''
        ? setUserIsLoggedIn(false)
        : setUserIsLoggedIn(true);
      result[StorageKeys.PLAN] == 'witty_teams'
        ? setHasWittyTeams(true)
        : setHasWittyTeams(false);
    });

    window.addEventListener('load', onOptionsLoad);

    return () => {
      window.removeEventListener('load', onOptionsLoad);
    };
  }, []);

  const onOptionsLoad = (event: Event) => {
    const searchParams = new URLSearchParams(
      (event.currentTarget as Window).location.search
    );

    if ([...searchParams].length > 0) {
      setUsername(searchParams.get('email') as string);
      setAccessToken(searchParams.get('access_token') as string);
      setRefreshToken(searchParams.get('refresh_token') as string);
      window.open(browser.runtime.getURL('options.html'), '_self');
    }
  };

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
    storeInLocalStorage(StorageKeys.DISABLED_SITES, disabledSites);
  }, [disabledSites]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.MAXIMUM_IMPORTANCE, maximumImportance);
  }, [maximumImportance]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.SINGULAR_THEY, singularThey);
  }, [singularThey]);

  useEffect(() => {
    storeInLocalStorage(
      StorageKeys.SHOW_INSPIRATION_ALTERNATIVES,
      inspirationalAlternatives
    );
  }, [inspirationalAlternatives]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.GENDERED_ROLES_FORMAT, genderRolesFormat);
  }, [genderRolesFormat]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.USERNAME, username);
  }, [username]);

  useEffect(() => {
    setToken(accessToken);
    storeInLocalStorage(StorageKeys.ACCESS_TOKEN, accessToken);
    if (accessToken != '') {
      getConfig();
    }
  }, [accessToken]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.REFRESH_TOKEN, refreshToken);
  }, [refreshToken]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.NAME, teamName);
  }, [teamName]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.PLAN, subscriptionPlan);
  }, [subscriptionPlan]);

  useEffect(() => {
    if (authResponse) {
      setTeamName(authResponse.name);
      setSubscriptionPlan(authResponse.plan);
      for (let key in authResponse.config) {
        switch (key) {
          case 'german_gender_ending':
            storeInLocalStorage(
              StorageKeys.GERMAN_GENDER_ENDING,
              authResponse.config[key]
            );
            break;
          case 'inclusive':
            setInclusiveLanguage(authResponse.config[key] as ConfigProperty);
            break;
          case 'maximum_importance':
            setMaximumImportance(authResponse.config[key] as ConfigProperty);
            break;
          case 'orthography':
            setOrthography(authResponse.config[key] as ConfigProperty);
            break;
          case 'preferred_variants':
            storeInLocalStorage(
              StorageKeys.PREFERRED_LANGUAGES,
              authResponse.config[key]
            );
            break;
          case 'show_inspiration_alternatives':
            setInspirationalAlternatives(
              authResponse.config[key] as ConfigProperty
            );
            break;
          case 'singular_they':
            setSingularThey(authResponse.config[key] as ConfigProperty);
            break;
          case 'style':
            setStyleCorrections(authResponse.config[key] as ConfigProperty);
            break;
          case 'gendered_roles_format':
            setGenderRolesFormat(authResponse.config[key] as ConfigProperty);
        }
      }
    }
  }, [authResponse]);

  useEffect(() => {
    console.log('authErrorResponse', authErrorResponse);
  }, [authErrorResponse]);

  const logIn = async () => {
    const url = `${baseUrl}/api/browser-login?redirect_uri=${originalOptionsUri}`;
    window.open(url, '_self');
  };

  const logOut = () => {
    setUsername('');
    setAccessToken('');
    setRefreshToken(''); //TODO sure?
    setUserIsLoggedIn(false);
    setTeamName('');
    setSubscriptionPlan('');
  };

  return (
    <>
      <div className='wittyworks-options-header'>
        <div className='wittyworks-options-header-content'>
          <WittyLogo
            onClick={() => {
              window.open('https://www.witty.works/', '_blank');
            }}
          />
          <div className='wittyworks-options-header-title'>{t('settings')}</div>
          <div
            className='wittyworks-options-header-button'
            onClick={() => {
              window.open('https://www.witty.works/onboarding', '_blank');
            }}
          >
            {t('needHelp')}
          </div>
        </div>
      </div>

      <div className='wittyworks-options-content'>
        <div className='wittyworks-upgrade-banner'>
          <div className='wittyworks-upgrade-banner-text-container'>
            <div className='wittyworks-upgrade-banner-title'>
              {t('getMoreTitle')}
            </div>
            <div className='wittyworks-upgrade-banner-text'>
              {t('getMoreText')}
            </div>
          </div>
          <div
            className='wittyworks-upgrade-banner-button'
            onClick={() => {
              window.open('https://www.witty.works/pricing', '_blank');
            }}
          >
            {t('getMoreButton')}
          </div>
        </div>

        <section className='wittyworks-options-login'>
          {username === '' ? (
            <div
              className='wittyworks-options-button'
              onClick={() => {
                logIn();
              }}
            >
              {t('LoginButton')}
            </div>
          ) : (
            <>
              <div className='wittyworks-options-login-text'>
                {t('greeting')}{' '}
                <span className='wittyworks-options-login-cursiva'>
                  {username}{' '}
                </span>
                {teamName !== '' && subscriptionPlan !== '' && (
                  <div>
                    {t('greetingTeam')}{' '}
                    <span className='wittyworks-options-login-cursiva'>
                      {teamName}{' '}
                    </span>
                    {t('greetingPlan')}{' '}
                    <span className='wittyworks-options-login-cursiva'>
                      {subscriptionPlan
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                )}
              </div>
              <div
                className='wittyworks-options-button'
                onClick={() => logOut()}
              >
                {t('Logout')}
              </div>
            </>
          )}
        </section>
        <section className='wittyworks-options-content-section'>
          <div
            className='wittyworks-options-content-section-title'
            onClick={() => {
              setRulesTabOpen(!rulesTabOpen);
            }}
          >
            {t('configureRules')}
            <div className='wittyworks-options-content-section-title-arrow'>
              {rulesTabOpen ? <ArrowUp /> : <ArrowDown />}
            </div>
          </div>
          <div className='wittyworks-options-content-section-container'>
            {rulesTabOpen && (
              <>
                <div className='wittyworks-options-content-section-container-item'>
                  <PreferedLanguagesSelector />
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={singularTheyToBoolean(singularThey.value as string)}
                    handleToggle={() => {
                      setSingularThey({
                        ...singularThey,
                        value:
                          singularThey.status != 'force'
                            ? changeSingularThey(
                                !singularTheyToBoolean(
                                  singularThey.value as string
                                )
                              )
                            : changeSingularThey(
                                singularTheyToBoolean(
                                  singularThey.value as string
                                )
                              ),
                      });
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('singularThey')}
                    locked={singularThey.status === 'force'}
                    userIsLoggedIn={userIsLoggedIn}
                  />

                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('singularTheyExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <GermanGenderEndSelector />
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <GenderRoleFormatSelector
                    locked={
                      !hasWittyTeams || genderRolesFormat.status == 'force'
                    }
                  />
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={maximumImportanceToBoolean(
                      maximumImportance.value as number
                    )}
                    handleToggle={() => {
                      setMaximumImportance({
                        ...maximumImportance,
                        value:
                          hasWittyTeams && maximumImportance.status != 'force'
                            ? changeMaximumImportance(
                                !maximumImportanceToBoolean(
                                  maximumImportance.value as number
                                )
                              )
                            : maximumImportanceToBoolean(
                                maximumImportance.value as number
                              ),
                      });
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('expertMode')}
                    locked={
                      maximumImportance.status == 'force' || !hasWittyTeams
                    }
                    hasWittyTeams={hasWittyTeams}
                    userIsLoggedIn={userIsLoggedIn}
                  />

                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('expertModeExplanation')}
                    <a
                      className='wittyworks-options-content-section-container-link'
                      href={t('expertModeExplanationUrl')}
                      target='_blank'
                    >
                      {t('learnMore')}
                    </a>
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={inspirationalAlternatives.value as boolean}
                    handleToggle={() => {
                      setInspirationalAlternatives({
                        ...inspirationalAlternatives,
                        value:
                          inspirationalAlternatives.status != 'force' &&
                          hasWittyTeams
                            ? !inspirationalAlternatives.value
                            : inspirationalAlternatives.value,
                      });
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('inspirationAlternatives')}
                    locked={
                      inspirationalAlternatives.status == 'force' ||
                      !hasWittyTeams
                    }
                    hasWittyTeams={hasWittyTeams}
                    userIsLoggedIn={userIsLoggedIn}
                  />
                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('inspirationAlternativesExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={inclusiveLanguage.value as boolean}
                    handleToggle={() => {
                      setInclusiveLanguage({
                        ...inclusiveLanguage,
                        value:
                          inclusiveLanguage.status != 'force'
                            ? !inclusiveLanguage.value
                            : inclusiveLanguage.value,
                      });
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('inclusiveTerms', { ns: namespaces.pages.popup })}
                    locked={inclusiveLanguage.status == 'force'}
                    userIsLoggedIn={userIsLoggedIn}
                  />
                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('inclusiveLanguageExplanation')}{' '}
                    <a
                      className='wittyworks-options-content-section-container-link'
                      href={t('inclusiveLanguageExplanationUrl')}
                      target='_blank'
                    >
                      {t('learnMore')}
                    </a>
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={styleCorrections.value as boolean}
                    handleToggle={() => {
                      setStyleCorrections({
                        ...styleCorrections,
                        value:
                          styleCorrections.status != 'force'
                            ? !styleCorrections.value
                            : styleCorrections.value,
                      });
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('styleCorrections', {
                      ns: namespaces.pages.popup,
                    })}
                    locked={styleCorrections.status == 'force'}
                    userIsLoggedIn={userIsLoggedIn}
                  />
                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('styleCorrectionExplanation')}{' '}
                    <a
                      className='wittyworks-options-content-section-container-link'
                      href={t('styleCorrectionExplanationUrl')}
                      target='_blank'
                    >
                      {t('learnMore')}
                    </a>
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={orthography.value as boolean}
                    handleToggle={() => {
                      setOrthography({
                        ...orthography,
                        value:
                          orthography.status != 'force'
                            ? !orthography.value
                            : orthography.value,
                      });
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('spellChecking', { ns: namespaces.pages.popup })}
                    locked={orthography.status == 'force'}
                    userIsLoggedIn={userIsLoggedIn}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <section className='wittyworks-options-content-section'>
          <div
            className='wittyworks-options-content-section-title'
            onClick={() => {
              setDisableTabOpen(!disableTabOpen);
            }}
          >
            {t('disableWitty')}
            <div className='wittyworks-options-content-section-title-arrow'>
              {disableTabOpen ? <ArrowUp /> : <ArrowDown />}
            </div>
          </div>
          {disableTabOpen && (
            <div className='wittyworks-options-content-section-container'>
              {disabledSites.map((site) => (
                <div
                  className='wittyworks-options-content-section-container-site-item'
                  key={`disabledSites-${site}`}
                >
                  <span className='wittyworks-options-content-section-container-site-url'>
                    {site}
                  </span>

                  <div className='wittyworks-options-content-section-container-site-icon'>
                    <Bin
                      onClick={() => {
                        setDisabledSites(
                          disabledSites.filter((s) => s !== site)
                        );
                      }}
                    />
                  </div>
                </div>
              ))}
              {addDomainTabOpen && (
                <div className='wittyworks-options-content-section-container-input-wrapper'>
                  <input
                    className='wittyworks-options-content-section-container-input'
                    type='text'
                    placeholder={t('addSite')}
                    onChange={(e) => {
                      setInput(e.target.value);
                    }}
                  />
                  <div
                    className='wittyworks-options-content-section-container-button'
                    onClick={() => {
                      if (
                        input.match(
                          /^(?:(?:(?:[a-zA-z\-]+)\:\/{1,3})?(?:[a-zA-Z0-9])(?:[a-zA-Z0-9\-\.]){1,61}(?:\.[a-zA-Z]{2,})+|\[(?:(?:(?:[a-fA-F0-9]){1,4})(?::(?:[a-fA-F0-9]){1,4}){7}|::1|::)\]|(?:(?:[0-9]{1,3})(?:\.[0-9]{1,3}){3}))(?:\:[0-9]{1,5})?$/
                        )
                      ) {
                        setDisabledSites([...disabledSites, input]);
                        setAddDomainTabOpen(false);
                        setInvalidDomain(false);
                      } else {
                        setInvalidDomain(true);
                      }
                    }}
                  >
                    OK
                  </div>
                </div>
              )}
              {invalidDomain && (
                <div className='wittyworks-options-content-section-container-item-error'>
                  {t('invalidDomain')}
                </div>
              )}
              <div
                className='wittyworks-options-content-section-container-add-domain'
                onClick={() => {
                  setAddDomainTabOpen(true);
                }}
              >
                + {t('addDomain')}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default Options;
