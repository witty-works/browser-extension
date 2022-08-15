import React, { useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import '../../i18n/i18n';
import '../styles.scss';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';
import PopupHeader from '../PopupComponents/PopupHeader';
import SadFace from '../../assets/icons/popup/sad-face.svg';
import UpvoteButton from '../../assets/icons/popup/upvote-button.svg';
import EditorButton from '../../assets/icons/popup/editor-button.svg';

interface domainDeactivatedProps {
  appId: string;
  domain: string;
}
const PopupDomainDeactivated: React.FC<domainDeactivatedProps> = ({
  appId,
  domain,
}) => {
  const { t } = useTranslation(namespaces.pages.popup);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const analytics = useAnalytics();
  return (
    <>
      <PopupHeader />
      <div className='domain-not-supported'>
        <div className='domain-not-supported-title-wrapper'>
          <SadFace className='domain-not-supported-icon' />
          <div className='domain-not-supported-title'>{t('noSupport')}</div>
        </div>
        <div
          className='domain-not-supported-container'
          onClick={() => {
            analytics.urlLog(domain, appId, 'vote');
            setHasVoted(true);
          }}
        >
          <UpvoteButton />
          <div>{!hasVoted ? t('vote') : t('thanks')}</div>
        </div>
        <div
          className='domain-not-supported-container'
          onClick={() =>
            browser.tabs.create({ url: 'https://www.witty.works/editor' })
          }
        >
          <EditorButton />
          <div>{t('editor')}</div>
        </div>
      </div>
    </>
  );
};

export default PopupDomainDeactivated;
