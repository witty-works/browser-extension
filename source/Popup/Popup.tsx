import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import ApiSelector from './ApiSelector';
import { DEV_ENV } from '../shared/constants';
import LanguageSelector from './LanguageSelector';
import PreferredLanguagesSelector from './PreferedLanguagesSelector';
import GermanGenderEndSelector from './GermanGenderEndSelector';
import EnableWitty from './EnableWitty';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';

import './styles.scss';

const Popup: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);
  return (
    <>
      <header>
        <h1>
          <a href='https://www.witty.works/' target='_blank'>
            <img
              className='icon'
              alt='Witty Works Logo'
              width='100'
              height='15'
              src={browser.runtime.getURL(
                '../assets/icons/witty-logo-color.svg'
              )}
            />
          </a>
        </h1>
      </header>
      <hr></hr>
      <section>
        <h2>{t('settings')}</h2>
        <EnableWitty />
        <LanguageSelector />
        <PreferredLanguagesSelector />
        <GermanGenderEndSelector />
      </section>
      {DEV_ENV ? (
        <>
          <hr></hr>
          <section>
            <h2>{t('developmentSettings')}</h2>
            <ApiSelector />
          </section>
        </>
      ) : null}
      <footer>
        <a href='https://www.witty.works/onboarding' target='_blank'>
          {t('needHelpQuestionMark')}
        </a>
      </footer>
    </>
  );
};

export default Popup;
