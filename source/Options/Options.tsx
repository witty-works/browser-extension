import { t } from 'i18next';
import * as React from 'react';
import { useState } from 'react';
import Toggle from '../shared/components/Toggle/Toggle';
import { Colors } from '../shared/constants';
import defaultConfig from '../witty.config.json';
import LanguageSelector from '../Popup/LanguageSelector';
import GermanGenderEndSelector from '../Popup/GermanGenderEndSelector';
import PreferedLanguagesSelector from '../Popup/PreferedLanguagesSelector';
import './styles.scss';
import WittyLogo from '../assets/icons/witty-logo-options-page.svg';

const Options: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(defaultConfig.APP_ENABLED);

  return (
    <>
      <div className='wittyworks-options-header'>
        <WittyLogo
          onClick={() => {
            window.open('https://www.witty.works/', '_blank');
          }}
        />
        <div className='wittyworks-options-header-title'>Settings</div>
        <div
          className='wittyworks-options-header-button'
          onClick={() => {
            window.open('https://www.witty.works/onboarding', '_blank');
          }}
        >
          Need Help?
        </div>
      </div>

      <div className='wittyworks-options-content'>
        <div className='wittyworks-upgrade-box'>
          <div className='wittyworks-upgrade-text--large'>
            GET MUCH MORE FROM WITTY!
          </div>
          <div className='wittyworks-upgrade-text'>
            Upgrade and get access to more checks, custom rules, and much more!
          </div>
          <div className='wittyworks-upgrade-button'>Upgrade now</div>
        </div>

        <h2>{t('settings')}</h2>
        <Toggle
          on={enabled}
          handleToggle={() => setEnabled(!enabled)}
          color={Colors.green}
          scale={0.35}
          label={t('enableWitty')}
        />

        <h2>Set up languages</h2>
        <LanguageSelector />
        <GermanGenderEndSelector />
        <PreferedLanguagesSelector />

        <h2>Configure how Witty checks your texts</h2>

        <h2>Disable Witty on some websites</h2>
      </div>
    </>
  );
};

export default Options;
