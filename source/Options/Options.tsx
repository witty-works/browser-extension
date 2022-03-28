import * as React from 'react';
import { useState } from 'react';
import LanguageSelector from '../Popup/LanguageSelector';
import GermanGenderEndSelector from '../Popup/GermanGenderEndSelector';
import PreferedLanguagesSelector from '../Popup/PreferedLanguagesSelector';
import EnableWitty from '../Popup/EnableWitty';
import './styles.scss';
import WittyLogo from '../assets/icons/options/witty-logo.svg';
import ArrowDown from '../assets/icons/options/arrow-down.svg';
import ArrowUp from '../assets/icons/options/arrow-up.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import '../i18n/i18n';

const Options: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.options);
  const [languagesTabOpen, setLanguagesTabOpen] = useState(false);
  // const [rulesTabOpen, setRulesTabOpen] = useState(false);
  // const [disableTabOpen, setDisableTabOpen] = useState(false);

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
        {/* 
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
          <div className='wittyworks-options-content-section-content'></div>
        </div> */}

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
