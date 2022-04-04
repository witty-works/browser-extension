import * as React from 'react';
import { useEffect, useState } from 'react';
import LanguageSelector from '../Popup/LanguageSelector';
import GermanGenderEndSelector from '../Popup/GermanGenderEndSelector';
import PreferedLanguagesSelector from '../Popup/PreferedLanguagesSelector';
import EnableWitty from '../Popup/EnableWitty';
import GlobalSettings from '../Popup/GlobalSettings';
import './styles.scss';
import WittyLogo from '../assets/icons/options/witty-logo.svg';
import ArrowDown from '../assets/icons/options/arrow-down.svg';
import ArrowUp from '../assets/icons/options/arrow-up.svg';
import Bin from '../assets/icons/options/bin.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';
import Toggle from '../shared/components/Toggle/Toggle';

import { Colors, StorageKeys } from '../shared/constants';
import { logTypes, useLog } from '../shared/customHooks/useLog';
import { browser } from 'webextension-polyfill-ts';
import defaultConfig from '../witty.config.json';

const Options: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.options);
  const [languagesTabOpen, setLanguagesTabOpen] = useState<boolean>(false);
  const [rulesTabOpen, setRulesTabOpen] = useState<boolean>(false);
  const [disableTabOpen, setDisableTabOpen] = useState<boolean>(false);
  const [disabledSites, setDisabledSites] = useState<string[]>([]);
  const [addDomainTabOpen, setAddDomainTabOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [invalidDomain, setInvalidDomain] = useState<boolean>(false);
  const [expertMode, setExpertMode] = useState<boolean>(
    defaultConfig.EXPERT_MODE
  );
  const [inspirationalAlternatives, setInspirationalAlternatives] =
    useState<boolean>(defaultConfig.INSPIRATIONAL_ALTERNATIVES);
  const [singularThey, setSingularThey] = useState<boolean>(
    defaultConfig.SINGULAR_THEY
  );

  const log = useLog('Options');

  useEffect(() => {
    browser.storage.local.get(null).then((result) => {
      setExpertMode(result[StorageKeys.MAXIMUM_IMPORTANCE]);
      setSingularThey(result[StorageKeys.SINGULAR_THEY]);
      setDisabledSites(result[StorageKeys.DISABLED_SITES]);
    });
  }, []);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.DISABLED_SITES, disabledSites);
  }, [disabledSites]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.MAXIMUM_IMPORTANCE, expertMode);
  }, [expertMode]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.SINGULAR_THEY, singularThey);
  }, [singularThey]);

  const storeInLocalStorage = (key: string, value: any) => {
    browser.storage.local
      .set({ [key]: value })
      .then(() => {
        log(`Witty ${key} *${value}* correctly saved`);
      })
      .catch(onError);
  };

  const onError = (error: string) => {
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
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
        <div className='wittyworks-upgrade-box'>
          <div className='wittyworks-upgrade-text-container'>
            <div className='wittyworks-upgrade-text--large'>
              {t('getMoreTitle')}
            </div>
            <div className='wittyworks-upgrade-text'>{t('getMoreText')}</div>
          </div>
          <div
            className='wittyworks-upgrade-button'
            onClick={() => {
              window.open('https://www.witty.works/pricing', '_blank');
            }}
          >
            {t('getMoreButton')}
          </div>
        </div>

        <div className='wittyworks-options-content-section-toggle'>
          <EnableWitty />
        </div>

        <div className='wittyworks-options-content-section'>
          <div
            className='wittyworks-options-content-section-title'
            onClick={() => {
              setLanguagesTabOpen(!languagesTabOpen);
            }}
          >
            {t('setUpLanguages')}
            <div className='wittyworks-options-content-section-icon'>
              {languagesTabOpen ? <ArrowUp /> : <ArrowDown />}
            </div>
          </div>
          {languagesTabOpen && (
            <div className='wittyworks-options-content-section-content'>
              <div className='wittyworks-options-content-section-content-item'>
                <LanguageSelector />
              </div>
              <div className='wittyworks-options-content-section-content-item'>
                <PreferedLanguagesSelector />
              </div>
              <div className='wittyworks-options-content-section-content-item'>
                <GermanGenderEndSelector />
              </div>
            </div>
          )}
        </div>

        <div className='wittyworks-options-content-section'>
          <div
            className='wittyworks-options-content-section-title'
            onClick={() => {
              setRulesTabOpen(!rulesTabOpen);
            }}
          >
            {t('configureRules')}
            <div className='wittyworks-options-content-section-icon'>
              {rulesTabOpen ? <ArrowUp /> : <ArrowDown />}
            </div>
          </div>
          <div className='wittyworks-options-content-section-content'>
            {rulesTabOpen && (
              <div className='wittyworks-options-content-section-content-items'>
                <Toggle
                  on={expertMode}
                  handleToggle={() => {
                    setExpertMode(!expertMode);
                  }}
                  color={Colors.green}
                  scale={0.35}
                  label={t('expertMode')}
                />
                <div className='wittyworks-options-content-section-content-subtitle'>
                  {t('expertModeExplanation')}
                </div>

                <GlobalSettings page={'options'} />

                {/* currently does nothing, is locked untill we have 'premium users' */}
                <Toggle
                  on={inspirationalAlternatives}
                  handleToggle={() => {
                    setInspirationalAlternatives(inspirationalAlternatives);
                  }}
                  color={Colors.green}
                  scale={0.35}
                  label={t('inspirationAlternatives')}
                />
                <div className='wittyworks-options-content-section-content-subtitle'>
                  {t('inspirationAlternativesExplanation')}
                </div>

                <Toggle
                  on={singularThey}
                  handleToggle={() => {
                    setSingularThey(!singularThey);
                  }}
                  color={Colors.green}
                  scale={0.35}
                  label={t('singularThey')}
                />
                <div className='wittyworks-options-content-section-content-subtitle'>
                  {t('singularTheysExplanation')}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='wittyworks-options-content-section'>
          <div
            className='wittyworks-options-content-section-title'
            onClick={() => {
              setDisableTabOpen(!disableTabOpen);
            }}
          >
            {t('disableWitty')}
            <div className='wittyworks-options-content-section-icon'>
              {disableTabOpen ? <ArrowUp /> : <ArrowDown />}
            </div>
          </div>
          {disableTabOpen && (
            <div className='wittyworks-options-content-section-content'>
              {disabledSites.map((site) => (
                <div
                  className='wittyworks-options-content-section-content-title'
                  key={`disabledSites-${site}`}
                >
                  {site}
                  <div className='wittyworks-options-content-section-content-icon'>
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
                <div className='wittyworks-options-content-section-content-input-wrapper'>
                  <input
                    className='wittyworks-options-content-section-content-input'
                    type='text'
                    placeholder={t('addSite')}
                    onChange={(e) => {
                      setInput(e.target.value);
                    }}
                  />
                  <div
                    className='wittyworks-options-content-section-content-button'
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
                <div className='wittyworks-options-content-section-content-item-error'>
                  {t('invalidDomain')}
                </div>
              )}
              <div
                className='wittyworks-options-content-section-content-item--purple'
                onClick={() => {
                  setAddDomainTabOpen(true);
                }}
              >
                + {t('addDomain')}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Options;
