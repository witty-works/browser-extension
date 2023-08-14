import React from 'react';
import './styles.scss';
import WittyIcon from '../assets/icons/witty-icon.svg';
import CloseIcon from '../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { getBaseUrls } from '../shared/ApiServices/requests';
import defaultConfig from '../witty.config.json';
import { getTextDividedByNodes } from '../ContentScript/utils';
import { CustomInputElement } from '../shared/types';

interface NotificationProps {
  notificationType: String;
  element: CustomInputElement | null;
}
const Notification: React.FC<NotificationProps> = ({notificationType, element}: NotificationProps ) => {
  const { t } = useTranslation(namespaces.notifications);
  const totalTextLength = element ? getTextDividedByNodes(element).map((node: any) => node.textContent).join('')?.length : 0;

  let notificationHeadline = '';
  let notificationText = '';
  let notificationButton = '';
  let notificationLink = '';

  switch (notificationType) {
    case 'pin':
      notificationHeadline = t('pinNotificationHeadline');
      notificationText = t('pinNotificationText');
      break;
    case 'totalMaxCharLengthReached':
      notificationHeadline = t('totalMaxCharLengthReachedNotificationHeadline');
      notificationText = t('totalMaxCharLengthReachedNotificationText', {limit: defaultConfig.TOTAL_MAX_CHAR_LENGTH, total: totalTextLength});
      notificationButton = t('subscriptionButton');
      notificationLink = getBaseUrls().dashboard + 'team/subscription';
      break;
    case 'salesDemo':
      notificationHeadline = t('salesDemoNotificationHeadline');
      notificationText = t('salesDemoNotificationText');
      notificationButton = t('salesDemoNotificationButton');
      notificationLink = 'https://www.witty.works/demo';
      break;
    case 'inviteTeam':
      notificationHeadline = t('inviteTeamNotificationHeadline');
      notificationText = t('inviteTeamNotificationText');
      notificationButton = t('inviteTeamNotificationButton');
      notificationLink = getBaseUrls().dashboard + 'team/show';
      break;
    case 'inviteFriends': 
      notificationHeadline = t('inviteFriendsNotificationHeadline');
      notificationText = t('inviteFriendsNotificationText');
      notificationButton = t('inviteFriendsNotificationButton');
      notificationLink = 'mailto:?subject=Check out Witty&body=Hey, I just found this great tool to improve my writing. It’s called Witty and it’s a browser extension that checks my writing for clarity, engagement, and tone. I think you’ll like it too. Check it out here: https://www.witty.works/';
      break;
    case 'update':
      notificationHeadline = t('updateNotificationHeadline');
      notificationText = t('updateNotificationText');
      notificationButton = t('updateNotificationButton');
      notificationLink = 'https://roadmap.witty.works/tabs/12-released';
      break;
    case 'min_version_not_installed':
      notificationHeadline = t('minVersionNotInstalledNotificationHeadline');
      notificationText = t('minVersionNotInstalledNotificationText');
      notificationButton = t('minVersionNotInstalledNotificationButton');
      notificationLink = 'https://chrome.google.com/webstore/detail/witty-your-inclusive-writ';
      break;
  }

  return (
    <div className="witty-works-notification-wrapper">
      <div className="witty-works-ext-container-row witty-works-notification-headline-wrapper">
        <div className="witty-works-notification-headline">{notificationHeadline}</div>
        <CloseIcon onClick={() => {document.getElementsByClassName('witty-works-notification-wrapper')[0].remove()}} style={{cursor: 'pointer', marginRight: '-1em'}} />
      </div>
      <div className="witty-works-ext-container-row">
        {notificationType == 'pin' && <WittyIcon className="witty-works-notification-icon"/>}
        <div className="witty-works-notification-text"><div dangerouslySetInnerHTML={{__html: notificationText}}></div>
        {notificationButton && 
          <div className='witty-works-ext-left'>
            <div className='witty-works-ext-button witty-works-ext-primary-button-red'
              onClick={() => { window.open(notificationLink, '_blank'); }}>
              {notificationButton}
            </div>
          </div>
        }
        </div> 
      </div>
      {notificationType == 'pin' && <img className="witty-works-pin-gif" src="https://www.witty.works/hubfs/pin_witty-2.gif" alt="pin-extension" />}
    </div>
  );
};

export default Notification;
