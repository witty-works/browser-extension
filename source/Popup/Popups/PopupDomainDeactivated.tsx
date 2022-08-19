import React, { useEffect, useState } from 'react';
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
import { sendErrorToSentry } from '../../shared/errorUtils';
import { setBaseUrls } from '../../shared/ApiServices/requests';
import { DefaultBaseUrlKey, StorageKeys } from '../../shared/constants';

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

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        setBaseUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
      })
      .catch((error) => {
        sendErrorToSentry(error);
      });
  }, []);

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
