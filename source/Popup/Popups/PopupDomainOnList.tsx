import React from 'react';
import { useTranslation } from 'react-i18next';
import { DEV_ENV } from '../../shared/constants';
import { namespaces } from '../../i18n/i18n.constants';
import '../../i18n/i18n';
import '../styles.scss';

import ApiSelector from '../PopupComponents/ApiSelector';
import DelaySelector from '../PopupComponents//DelaySelector';
import PopupHeader from '../PopupComponents/PopupHeader';
import Checkmark from '../../assets/icons/popup/checkmark.svg';

interface PopupDomainOnListProps {
  listType: string;
}

const PopupDomainOnList: React.FC<PopupDomainOnListProps> = ({
  listType,
}: PopupDomainOnListProps) => {
  const { t } = useTranslation([namespaces.pages.popup]);

  return (
    <>
      <PopupHeader />
      <section>
        <div className='wittyworks-signin-container'>
          <div className='wittyworks-signin-benefits-list-icon'>
            <Checkmark />
          </div>
          {listType === 'deny' && (
            <div className='wittyworks-signin-benefits-list-text-large'>
              {t('domainBlocked')}
            </div>
          )}
          {listType === 'allow' && (
            <div className='wittyworks-signin-benefits-list-text-large'>
              {t('domainNotAlloweYet')}
            </div>
          )}
        </div>
      </section>
      {DEV_ENV && (
        <section>
          <h2>{t('developmentSettings')}</h2>
          <ApiSelector />
          <DelaySelector />
        </section>
      )}
    </>
  );
};

export default PopupDomainOnList;
