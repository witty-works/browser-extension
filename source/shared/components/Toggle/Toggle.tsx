import React from 'react';

import { ConfigPropertyStatus } from '../../constants';
import './Toggle.scss';
import Lock from '../../../assets/icons/options/lock.svg';
import PremiumOnly from '../../../assets/icons/options/premium-only.svg';

interface ToggleProps {
  on: boolean | undefined;
  handleToggle: () => void;
  color: string;
  scale: number;
  label: string;
  locked?: boolean;
  iconType?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  on,
  handleToggle,
  color,
  scale,
  label,
  locked,
  iconType,
}: ToggleProps) => {
  return (
    <>
      <div
        className='toggle-container'
        style={{
          height: `${50 * scale}px`,
        }}
      >
        <label className='toggle-label'>{label}</label>
        {iconType === ConfigPropertyStatus.FORCE && (
          <div className='toggle-icon'>
            <Lock />
          </div>
        )}
        <input
          checked={on}
          onChange={handleToggle}
          className='toggle-checkbox'
          id={`toggle-${label}`}
          type='checkbox'
        />
        {locked && iconType != ConfigPropertyStatus.FORCE && (
          <>
            <div className='toggle-premium-only'>
              <a href='https://www.witty.works/pricing' target='_blank'>
                <PremiumOnly />
              </a>
            </div>
            <div className='toggle-lock'>
              <Lock />
            </div>
          </>
        )}
        <label
          style={{
            background: (on && color) as string,
            transform: `translateX(${scale * 100}%) scale(${scale}, ${scale})`,
          }}
          className='toggle-encloser'
          htmlFor={`toggle-${label}`}
        >
          <span className={`toggle-button`} />
        </label>
      </div>
    </>
  );
};

export default Toggle;
