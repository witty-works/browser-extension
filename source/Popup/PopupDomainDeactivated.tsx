import React, { useEffect } from 'react';
import { browser } from 'webextension-polyfill-ts';
import '../i18n/i18n';
import './styles.scss';
import SadFace from '../assets/icons/popup/sad-face.svg';
import UpvoteButton from '../assets/icons/popup/upvote-button.svg';
import EditorButton from '../assets/icons/popup/editor-button.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';
import { StorageKeys } from '../shared/constants';

const PopupDomainDeactivated: React.FC = () => {
  const { t } = useTranslation(namespaces.pages.popup);
  const [pageName, setPageName] = React.useState<string>('');
  const [currentTab, setCurrentTab] = React.useState<string>('');
  const [hasVoted, setHasVoted] = React.useState<boolean>(false);
  const analytics = useAnalytics();
  const [appId, setAppId] = React.useState<string>('');

  useEffect(() => {
    setHasVoted(false);

    browser.storage.local.get(null).then((result) => {
      setAppId(result[StorageKeys.APP_ID]);
    });

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      //Empty tab
      if (tabs.length === 0 || !tabs[0].url) setPageName('this page');
      else {
        setCurrentTab(tabs[0].url);
        const currentDomain = new URL(tabs[0].url).hostname
          .replace('www.', '')
          .split('.')[0];
        setPageName(
          `${currentDomain.charAt(0).toUpperCase()}${currentDomain.slice(1)}`
        );
      }
    });
  }, []);

  return (
    <div className='domain-not-supported'>
      <div className='domain-not-supported-title-wrapper'>
        <SadFace className='domain-not-supported-icon' />
        <div className='domain-not-supported-title'>
          {`${t('noSupport')} ${pageName}`}
        </div>
      </div>

      <div
        className='domain-not-supported-container'
        onClick={() => {
          analytics.voteForUrlLog(currentTab, appId);
          setHasVoted(true);
        }}
      >
        <UpvoteButton />
        {!hasVoted ? <div>{t('vote')}</div> : <div>{t('thanks')}</div>}
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
    </div>
  );
};

export default PopupDomainDeactivated;
