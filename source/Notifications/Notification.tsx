import React, { useEffect, useState } from 'react';
import './styles.scss';
import WittyIcon from '../assets/icons/witty-icon.svg';
import CloseIcon from '../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../i18n/i18n.constants';
import { getBaseUrls } from '../shared/ApiServices/requests';
import defaultConfig from '../witty.config.json';
import { getTextDividedByNodes } from '../ContentScript/utils';
import { CustomInputElement, FeatureFlags } from '../shared/types';
import browser from 'webextension-polyfill';
import { StorageKeys } from '../shared/constants';
import { useAnalytics } from '../shared/ApiServices/useAnalytics';

interface NotificationProps {
  notificationType: string;
  element: CustomInputElement | null;
}

const Notification: React.FC<NotificationProps> = ({
  notificationType,
  element,
}: NotificationProps) => {
  const { t } = useTranslation(namespaces.notifications);
  const totalTextLength = element
    ? getTextDividedByNodes(element)
        .map((node: any) => node.textContent)
        .join('')?.length
    : 0;
  const english = window.navigator.language.includes('en');

  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    salesDemoFlag: null,
    teamInviteFlag: null,
    friendInviteFlag: null,
  });

  useEffect(() => {
    // Load feature flags when the component mounts
    const fetchData = async () => {
      const salesDemoFlag = await browser.storage.local.get(
        StorageKeys.SALES_DEMO_FEATURE_FLAG
      );
      const teamInviteFlag = await browser.storage.local.get(
        StorageKeys.INVITE_TEAM_FEATURE_FLAG
      );
      const friendInviteFlag = await browser.storage.local.get(
        StorageKeys.INVITE_FRIENDS_FEATURE_FLAG
      );

      setFeatureFlags({
        salesDemoFlag: salesDemoFlag[StorageKeys.SALES_DEMO_FEATURE_FLAG],
        teamInviteFlag: teamInviteFlag[StorageKeys.INVITE_TEAM_FEATURE_FLAG],
        friendInviteFlag: friendInviteFlag[StorageKeys.INVITE_FRIENDS_FEATURE_FLAG],
      });
    };

    fetchData();
  }, []);

  let notificationHeadline = '';
  let notificationText = '';
  let notificationButton = '';
  let notificationLink = '';
  const isFeatureFlagNotification = notificationType === 'salesDemo' || notificationType === 'inviteTeam' || notificationType === 'inviteFriends';
  const analytics = useAnalytics();

  switch (notificationType) {
    case 'pin':
      notificationHeadline = t('pinNotificationHeadline');
      notificationText = t('pinNotificationText');
      break;
    case 'totalMaxCharLengthReached':
      notificationHeadline = t('totalMaxCharLengthReachedNotificationHeadline');
      notificationText = t('totalMaxCharLengthReachedNotificationText', {
        limit: defaultConfig.MAX_CHAR_LENGTH_TOTAL_FREEMIUM,
        total: totalTextLength,
      });
      notificationButton = t('subscriptionButton');
      notificationLink = getBaseUrls().dashboard + 'team/subscription';
      break;
    case 'salesDemo':
      notificationHeadline = english
        ? featureFlags.salesDemoFlag?.notificationHeadline_en || ''
        : featureFlags.salesDemoFlag?.notificationHeadline_de || '';
      notificationText = english
        ? featureFlags.salesDemoFlag?.notificationText_en || ''
        : featureFlags.salesDemoFlag?.notificationText_de || '';
      notificationButton = english
        ? featureFlags.salesDemoFlag?.notificationButton_en || ''
        : featureFlags.salesDemoFlag?.notificationButton_de || '';
      notificationLink = 'https://www.witty.works/demo';
      break;
    case 'inviteTeam':
      notificationHeadline = english
        ? featureFlags.teamInviteFlag?.notificationHeadline_en || ''
        : featureFlags.teamInviteFlag?.notificationHeadline_de || '';
      notificationText = english
        ? featureFlags.teamInviteFlag?.notificationText_en || ''
        : featureFlags.teamInviteFlag?.notificationText_de || '';
      notificationButton = english
        ? featureFlags.teamInviteFlag?.notificationButton_en || ''
        : featureFlags.teamInviteFlag?.notificationButton_de || '';
      notificationLink = getBaseUrls().dashboard + 'team/show';
      break;
    case 'inviteFriends':
      notificationHeadline = english
        ? featureFlags.friendInviteFlag?.notificationHeadline_en || ''
        : featureFlags.friendInviteFlag?.notificationHeadline_de || '';
      notificationText = english
        ? featureFlags.friendInviteFlag?.notificationText_en || ''
        : featureFlags.friendInviteFlag?.notificationText_de || '';
      notificationButton = english
        ? featureFlags.friendInviteFlag?.notificationButton_en || ''
        : featureFlags.friendInviteFlag?.notificationButton_de || '';
      notificationLink =
        'mailto:?subject=Check out Witty&body=Hey, I just found this great tool to improve my writing. It’s called Witty and it’s a browser extension that checks my writing for clarity, engagement, and tone. I think you’ll like it too. Check it out here: https://www.witty.works/';
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
      notificationLink = 'https://www.witty.works/en/help/how-can-i-update-witty';
      break;
  }

  return (
    <div className="witty-works-notification-wrapper">
      <div className="witty-works-ext-container-row witty-works-notification-headline-wrapper">
        <div className="witty-works-notification-headline">{notificationHeadline}</div>
        <CloseIcon
          onClick={() => {
            const notificationWrapper = document.getElementsByClassName('witty-works-notification-wrapper')[0];
            isFeatureFlagNotification && analytics.featureFlagLog(notificationType, false);
            if (notificationWrapper) {
              notificationWrapper.remove();
            }
          }}
          style={{ cursor: 'pointer', marginRight: '-1em' }}
        />
      </div>
      <div className="witty-works-ext-container-row">
        {notificationType === 'pin' && <WittyIcon className="witty-works-notification-icon" />}
        <div className="witty-works-notification-text">
          {notificationText} 
          {notificationButton && (
            <div className="witty-works-ext-left">
              <div
                className="witty-works-ext-button witty-works-ext-primary-button-red witty-works-ext-margin-top"
                onClick={() => {
                  window.open(notificationLink, '_blank');
                  isFeatureFlagNotification && analytics.featureFlagLog(notificationType, true);

                  //close notification once it has been clicked 
                  const notificationWrapper = document.getElementsByClassName('witty-works-notification-wrapper')[0];
                  if (notificationWrapper) {
                    notificationWrapper.remove();
                  }
                }}
              >
                {notificationButton}
              </div>
            </div>
          )}
        </div>
      </div>
      {notificationType === 'pin' && (
        <img
          className="witty-works-pin-gif"
          src="https://www.witty.works/hubfs/pin_witty-2.gif"
          alt="pin-extension"
        />
      )}
    </div>
  );
};

export default Notification;
