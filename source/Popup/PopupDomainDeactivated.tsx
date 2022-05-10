import React from 'react';
import { browser } from 'webextension-polyfill-ts';
import '../i18n/i18n';
import './styles.scss';
import SadFace from '../assets/icons/popup/sad-face.svg';
import UpvoteButton from '../assets/icons/popup/upvote-button.svg';
import EditorButton from '../assets/icons/popup/editor-button.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import Settings from '../assets/icons/popup/settings.svg';
import ArrowIcon from '../shared/animations/Arrow';
import { storeInLocalStorage } from '../shared/utils';
import { StorageKeys } from '../shared/constants';

const PopupDomainDeactivated: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);

  return (
    <div className='domain-not-supported'>
      <div className='domain-not-supported-title-wrapper'>
        <SadFace className='domain-not-supported-icon' />
        <div className='domain-not-supported-title'>{t('noSupport')}</div>
      </div>

      <div
        className='domain-not-supported-container'
        onClick={() =>
          browser.tabs.create({ url: 'https://roadmap.witty.works/' })
        }
      >
        <UpvoteButton />
        <div>{t('vote')}</div>
      </div>

      <div
        className='domain-not-supported-container'
        onClick={() =>
          browser.tabs.create({ url: 'https://www.witty.works/form' })
        }
      >
        <EditorButton />
        <div>{t('editor')}</div>
      </div>
      <footer>
        <div
          className='enable-witty'
          onClick={() => {
            storeInLocalStorage(StorageKeys.ENABLE_WITTY_EVERYWHERE, true);
          }}
        >
          {t('overrideRecomendedSites')}
          <ArrowIcon play={true} />
        </div>
        <Settings
          onClick={
            //Is necessary to explicitly close the popup in Firefox. In Chrome is the default behaviour
            () => browser.runtime.openOptionsPage().then(() => window.close())
          }
        />
      </footer>
    </div>
  );
};

export default PopupDomainDeactivated;
