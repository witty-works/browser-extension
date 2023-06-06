import React from 'react';
import './styles.scss';
import WittyIcon from '../assets/icons/witty-icon.svg';
import CloseIcon from '../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';

interface NotificationProps {
  notificationType: String;
}
const Notification: React.FC<NotificationProps> = ({notificationType}: NotificationProps) => {
  const { t } = useTranslation([namespaces.notifications]);

  let notificationHeadline = '';
  let notificationText = '';

  switch (notificationType) {
    case 'pin':
      notificationHeadline = t('pinNotificationHeadline');
      notificationText = t('pinNotificationText');
      break;
    case 'totalMaxCharLengthReached':
      notificationHeadline = t('totalMaxCharLengthReachedNotificationHeadline');
      notificationText = t('totalMaxCharLengthReachedNotificationText');
      break;
  }

  return (
    <div className="witty-works-notification-wrapper">
      <div className="witty-works-ext-container-row witty-works-notification-headline-wrapper">
        <div className="witty-works-notification-headline">{notificationHeadline}</div>
        <CloseIcon onClick={() => {document.getElementsByClassName('witty-works-notification-wrapper')[0].remove()}} style={{cursor: 'pointer', marginRight: '-1em'}} />
      </div>
      <div className="witty-works-ext-container-row" style={{marginTop: '0.5em'}}>
        <WittyIcon className="witty-works-notification-icon"/>
        <div className="witty-works-notification-text">{notificationText}</div> 
      </div>
      {notificationType == 'pin' && <img className="witty-works-pin-gif" src="https://www.witty.works/hubfs/pin_witty-2.gif" alt="pin-extension" />}
    </div>
  );
};

export default Notification;
