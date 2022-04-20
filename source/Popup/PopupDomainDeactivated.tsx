import React from 'react';
import { browser } from 'webextension-polyfill-ts';
import '../i18n/i18n';
import './styles.scss';
import SadFace from '../assets/icons/popup/sad-face.svg';
import UpvoteButton from '../assets/icons/popup/upvote-button.svg';
import EditorButton from '../assets/icons/popup/editor-button.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';

const PopupDomainDeactivated: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);

  return (
    <section className='domain-not-supported'>
      <div className='domain-not-supported-title'>
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
    </section>
  );
};

export default PopupDomainDeactivated;
