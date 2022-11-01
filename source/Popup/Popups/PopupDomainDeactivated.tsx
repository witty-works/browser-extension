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
      <PopupHeader appId={appId} />
      <div className='witty-works-ext-section'>
        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
          <div className='witty-works-ext-margin-right'>
            <SadFace />
          </div>
          <div className='witty-works-ext-lato-small-paragraph-title-h4'>
            {t('noSupport')}
          </div>
        </div>
        <div
          className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'
          onClick={() => {
            analytics.urlLog(domain, appId, 'vote');
            setHasVoted(true);
          }}
        >
          <UpvoteButton />
          <div className='witty-works-ext-lato-popup-text'>
            {!hasVoted ? t('vote') : t('thanks')}
          </div>
        </div>
        <div
          className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'
          onClick={() =>
            browser.tabs.create({ url: 'https://www.witty.works/editor' })
          }
        >
          <EditorButton />
          <div className='witty-works-ext-lato-popup-text'>{t('editor')}</div>
        </div>
      </div>
    </>
  );
};

export default PopupDomainDeactivated;
