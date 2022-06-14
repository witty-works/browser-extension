import React from 'react';

import './Toggle.scss';
import Lock from '../../../assets/icons/options/lock.svg';
import PremiumOnly from '../../../assets/icons/options/premium-only.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../../i18n/i18n.constants';

interface ToggleProps {
  on: boolean | undefined;
  handleToggle: () => void;
  color: string;
  scale: number;
  label: string;
  locked?: boolean;
  hasWittyTeams?: boolean;
  userIsLoggedIn?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  on,
  handleToggle,
  color,
  scale,
  label,
  locked,
  hasWittyTeams = true,
  userIsLoggedIn = true,
}: ToggleProps) => {
  const { t } = useTranslation([namespaces.pages.options]);
  return (
    <>
      <div
        className='toggle-container'
        style={{
          height: `${50 * scale}px`,
        }}
      >
        <label className='toggle-label'>{label}</label>
        <input
          className='toggle-checkbox'
          checked={on}
          onChange={handleToggle}
          id={`toggle-${label}`}
          type='checkbox'
        />
        {!hasWittyTeams && (
          <>
            <div className='toggle-premium-only'>
              <a href='https://www.witty.works/witty-for-teams' target='_blank'>
                <PremiumOnly />
              </a>
            </div>
            <div className='toggle-lock'>
              <Lock />
            </div>
          </>
        )}
        {userIsLoggedIn && locked && hasWittyTeams && (
          <div className='toggle-lock'>
            <Lock />
            {<div className='toggle-lock-info'> {t('lockedInfo')} </div>}
          </div>
        )}

        <label
          style={{
            background: (on && color) as string,
            transform: `translateX(${scale * 100}%) scale(${scale}, ${scale})`,
          }}
          className='toggle-encloser'
          htmlFor={`toggle-${label}`}
        >
          <span
            className={`toggle-button`}
            style={{
              marginLeft: on && locked && userIsLoggedIn ? '2.7em' : '0', //TEMP: fix for weird toggle behavior when locked
            }}
          />
        </label>
      </div>
    </>
  );
};

export default Toggle;
