import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import Notification from './Notification';
import { CustomInputElement } from '../shared/types';

export const renderNotificationToTop = (
  notificationType: string,
  element: CustomInputElement | null
) => {
  try {
    if (!window.top) return;

    const notificationWrapper = document.createElement('div');
    notificationWrapper.id = 'ww-notification';

    window.top.document.body.insertBefore(
      notificationWrapper,
      window.top.document.body.firstChild
    );

    const root: Root = createRoot(notificationWrapper);

    const close = () => {
      try {
        root.unmount();
      } catch (err) {
        // ignore
      }
      try {
        notificationWrapper.remove();
      } catch (err) {
        // ignore
      }
    };

    root.render(
      <Notification
        notificationType={notificationType}
        element={element}
        onClose={close}
      />
    );
  } catch (error) {
    // swallow to avoid breaking host page
  }
};

export default renderNotificationToTop;
