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
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';
import Toggle from '../shared/components/Toggle/Toggle';
import { Colors, StorageKeys } from '../shared/constants';
import { browser } from 'webextension-polyfill-ts';
import { logTypes, useLog } from '../shared/customHooks/useLog';

const Options: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.options);
  const [languagesTabOpen, setLanguagesTabOpen] = useState(false);
  const [rulesTabOpen, setRulesTabOpen] = useState(false);
  const [expertMode, setExpertMode] = useState(false);
  const [inspirationalAlternatives, setInspirationalAlternatives] =
    useState(false);
  const [singularThey, setSingularThey] = useState(false);

  // const [disableTabOpen, setDisableTabOpen] = useState(false);

  const log = useLog('Popup');

  useEffect(() => {
    browser.storage.local
      .get(StorageKeys.MAXIMUM_IMPORTANCE)
      .then((result) => {
        setExpertMode(result[StorageKeys.MAXIMUM_IMPORTANCE]);
      })
      .catch(onError);

    browser.storage.local
      .get(StorageKeys.INSPIRATIONAL_ALTERNATIVES)
      .then((result) => {
        setInspirationalAlternatives(
          result[StorageKeys.INSPIRATIONAL_ALTERNATIVES]
        );
      })
      .catch(onError);

    browser.storage.local
      .get(StorageKeys.SINGULAR_THEY)
      .then((result) => {
        setSingularThey(result[StorageKeys.SINGULAR_THEY]);
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    browser.storage.local
      .set({ [StorageKeys.MAXIMUM_IMPORTANCE]: expertMode })
      .then(() => {
        log(
          `Witty ${StorageKeys.MAXIMUM_IMPORTANCE} *${expertMode}* correctly saved`
        );
      })
      .catch(onError);
  }, [expertMode]);

  useEffect(() => {
    browser.storage.local
      .set({
        [StorageKeys.INSPIRATIONAL_ALTERNATIVES]: inspirationalAlternatives,
      })
      .then(() => {
        log(
          `Witty ${StorageKeys.INSPIRATIONAL_ALTERNATIVES} *${inspirationalAlternatives}* correctly saved`
        );
      })
      .catch(onError);
  }, [inspirationalAlternatives]);

  useEffect(() => {
    browser.storage.local
      .set({ [StorageKeys.SINGULAR_THEY]: singularThey })
      .then(() => {
        log(
          `Witty ${StorageKeys.SINGULAR_THEY} *${singularThey}* correctly saved`
        );
      })
      .catch(onError);
  }, [singularThey]);

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
          <div className='wittyworks-upgrade-button'>{t('getMoreButton')}</div>
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
              <>
                <div className='wittyworks-options-content-section-content-item'>
                  <Toggle
                    on={expertMode}
                    handleToggle={() => {
                      setExpertMode(!expertMode);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('expertMode')}
                  />
                  <div className='wittyworks-options-content-section-content-item-subtitle'>
                    {t('expertModeExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-content-item'>
                  <GlobalSettings />

                  <div className='wittyworks-options-content-section-content-item-subtitle'>
                    {t('styleCorrectionExplanation')}
                  </div>

                  <div className='wittyworks-options-content-section-content-item-subtitle'>
                    {t('inclusiveLanguageExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-content-item'>
                  <Toggle
                    on={inspirationalAlternatives}
                    handleToggle={() => {
                      setInspirationalAlternatives(!inspirationalAlternatives);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('inspirationAlternatives')}
                  />
                  <div className='wittyworks-options-content-section-content-item-subtitle'>
                    {t('inspirationAlternativesExplanation')}
                  </div>
                </div>

                <div className='wittyworks-options-content-section-content-item'>
                  <Toggle
                    on={singularThey}
                    handleToggle={() => {
                      setSingularThey(!singularThey);
                    }}
                    color={Colors.green}
                    scale={0.35}
                    label={t('singularThey')}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* <div className='wittyworks-options-content-section'>
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
          <div className='wittyworks-options-content-section-content'></div>
        </div> */}
      </div>
    </>
  );
};

export default Options;
