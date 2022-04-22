import * as React from 'react';
import { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';

import defaultConfig from '../witty.config.json';
import { Colors, StorageKeys } from '../shared/constants';
import { storeInLocalStorage } from '../shared/utils';
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
  const [spellChecking, setSpellChecking] = useState<boolean>(
    defaultConfig.SPELL_CHECKING
  );
  const [inclusiveLanguage, setInclusiveLanguage] = useState<boolean>(
    defaultConfig.INCLUSIVE_LANGUAGE
  );
  const [styleCorrections, setStyleCorrections] = useState<boolean>(
    defaultConfig.STYLE_CORRECTIONS
  );
  const [expertMode /* , setExpertMode */] = useState<boolean>(
    defaultConfig.EXPERT_MODE
  );
  const [inspirationalAlternatives /* , setInspirationalAlternatives */] =
    useState<boolean>(defaultConfig.INSPIRATIONAL_ALTERNATIVES);
  const [singularThey, setSingularThey] = useState<boolean>(
    defaultConfig.SINGULAR_THEY
  );

  useEffect(() => {
    browser.storage.local.get(null).then((result) => {
      setSpellChecking(result[StorageKeys.SPELL_CHECKING]);
      setInclusiveLanguage(result[StorageKeys.INCLUSIVE_LANGUAGE]);
      setStyleCorrections(result[StorageKeys.STYLE_CORRECTIONS]);
      // setExpertMode(
      //   result[StorageKeys.MAXIMUM_IMPORTANCE] === 3 ? true : false
      // );
      setSingularThey(result[StorageKeys.SINGULAR_THEY]);
      setDisabledSites(result[StorageKeys.DISABLED_SITES]);
    });
  }, []);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.SPELL_CHECKING, spellChecking);
  }, [spellChecking]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.INCLUSIVE_LANGUAGE, inclusiveLanguage);
  }, [inclusiveLanguage]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.STYLE_CORRECTIONS, styleCorrections);
  }, [styleCorrections]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.DISABLED_SITES, disabledSites);
  }, [disabledSites]);

  // useEffect(() => {
  //   storeInLocalStorage(StorageKeys.MAXIMUM_IMPORTANCE, expertMode);
  // }, [expertMode]);

  useEffect(() => {
    storeInLocalStorage(StorageKeys.SINGULAR_THEY, singularThey);
  }, [singularThey]);

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
                    on={singularThey}
                    handleToggle={() => {
                      setSingularThey(!singularThey);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('singularThey')}
                  />

                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('singularTheyExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <GermanGenderEndSelector />
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={expertMode}
                    // handleToggle={() => {
                    //   setExpertMode(!expertMode);
                    // }}
                    handleToggle={() => {}}
                    color={Colors.green}
                    scale={0.35}
                    label={t('expertMode')}
                    locked
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

                {/* currently does nothing, is locked untill we have 'premium users' */}
                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={inspirationalAlternatives}
                    // handleToggle={() => {
                    //   setInspirationalAlternatives(inspirationalAlternatives);
                    // }}
                    handleToggle={() => {}}
                    color={Colors.green}
                    scale={0.35}
                    label={t('inspirationAlternatives')}
                    locked
                  />
                  <div className='wittyworks-options-content-section-container-subtitle'>
                    {t('inspirationAlternativesExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-container-item'>
                  <Toggle
                    on={inclusiveLanguage}
                    handleToggle={() => {
                      setInclusiveLanguage(!inclusiveLanguage);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('inclusiveTerms', { ns: namespaces.pages.popup })}
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
                    on={styleCorrections}
                    handleToggle={() => {
                      setStyleCorrections(!styleCorrections);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('styleCorrections', {
                      ns: namespaces.pages.popup,
                    })}
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
                    on={spellChecking}
                    handleToggle={() => {
                      setSpellChecking(!spellChecking);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('spellChecking', { ns: namespaces.pages.popup })}
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
