import React from 'react';

import './Toggle.scss';
import '../../../Popup/styles.scss';
import Lock from '../../../assets/icons/popup/lock.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../../i18n/i18n.constants';
import { Colors } from '../../constants';

interface ToggleProps {
  on: boolean | undefined;
  handleToggle: () => void;
  label: string;
  locked?: boolean;
  hasWittyTeams?: boolean;
  userIsLoggedIn?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  on,
  handleToggle,
  label,
  locked,
  hasWittyTeams = true,
  userIsLoggedIn = true,
}: ToggleProps) => {
  const { t } = useTranslation([namespaces.pages.popup]);
  const scale = 0.35;
  return (
    <>
      <div
        className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'
        style={{
          height: '35px',
        }}
      >
        <label className='witty-works-ext-lato-popup-text'>{label}</label>
        <input
          className='witty-works-ext-toggle-checkbox'
          checked={on}
          onChange={handleToggle}
          id={`toggle-${label}`}
          type='checkbox'
        />
        {!hasWittyTeams && (
          <div className='witty-works-ext-toggle-premium-only'>
            <a
              className='witty-works-ext-witty-teams-only-link'
              href='https://www.witty.works/witty-for-teams'
              target='_blank'
            >
              {t('wittyTeamsOnly')}
            </a>
          </div>
        )}
        {userIsLoggedIn && locked && hasWittyTeams && (
          <div className='witty-works-ext-toggle-lock'>
            <Lock />
            <div className='witty-works-ext-toggle-lock-info'>
              {t('lockedInfo')}
            </div>
          </div>
        )}

        <label
          style={{
            background: (hasWittyTeams && on && Colors.green) as string,
            transform: `translateX(${scale * 100}%) scale(${scale}, ${scale})`,
          }}
          id={`toggle-encloser-${label.replace(/\s+|&/g, '-').toLowerCase()}`}
          className='witty-works-ext-toggle-encloser'
          htmlFor={`toggle-${label}`}
        >
          <span
            id={`toggle-button-${label.replace(/\s+|&/g, '-').toLowerCase()}`}
            className={`witty-works-ext-toggle-button`}
            style={{
              marginLeft: on && locked && userIsLoggedIn ? '3.5em' : '0', //TEMP: fix for weird toggle behavior when locked
            }}
          />
        </label>
      </div>
    </>
  );
};

export default Toggle;
