import React from 'react';

import { useTranslation } from 'react-i18next';
import { namespaces } from '../../../i18n/i18n.constants';
import './Toast.scss';

const Toast: React.FC<{ message: string; type: string }> = ({
  message,
  type,
}) => {
  const { t } = useTranslation([namespaces.errors]);

  return (
    <div className={`witty-toast ${type}`}>
      <div className='witty-toast-title'>{t('errorMessageGenericTitle')}</div>
      <div className='witty-toast-message'>{message}</div>
    </div>
  );
};

export default Toast;
