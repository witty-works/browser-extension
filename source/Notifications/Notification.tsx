import React from 'react';
import './styles.scss';
import WittyIcon from '../assets/icons/witty-icon.svg';
import CloseIcon from '../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { getBaseUrls } from '../shared/ApiServices/requests';
import defaultConfig from '../witty.config.json';

interface NotificationProps {
  notificationType: String;
}
const Notification: React.FC<NotificationProps> = ({notificationType}: NotificationProps) => {
  const { t } = useTranslation(namespaces.notifications);

  let notificationHeadline = '';
  let notificationText = '';

  switch (notificationType) {
    case 'pin':
      notificationHeadline = t('pinNotificationHeadline');
      notificationText = t('pinNotificationText');
      break;
    case 'totalMaxCharLengthReached':
      notificationHeadline = t('totalMaxCharLengthReachedNotificationHeadline');
      notificationText = t('totalMaxCharLengthReachedNotificationText', {limit: defaultConfig.TOTAL_MAX_CHAR_LENGTH});
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
        {notificationType == 'totalMaxCharLengthReached' && 
          <div className='witty-works-ext-left witty-works-ext-margin-top'>
            <div className='witty-works-ext-button witty-works-ext-primary-button-red'
              onClick={() => { window.open(getBaseUrls().dashboard + 'team/subscription', '_blank'); }}>
              {t('subscriptionButton')}
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
