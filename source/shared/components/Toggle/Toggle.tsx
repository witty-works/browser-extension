import React from 'react';

import './Toggle.scss';
import Lock from '../../../assets/icons/options/lock.svg';
import PremiumOnly from '../../../assets/icons/options/premium-only.svg';

interface ToggleProps {
  on: boolean | undefined;
  handleToggle: () => void;
  color: string;
  scale: number;
  label: string;
  locked: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  on,
  handleToggle,
  color,
  scale,
  label,
  locked,
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
        <input
          checked={on}
          onChange={handleToggle}
          className='toggle-checkbox'
          id={`toggle-${label}`}
          type='checkbox'
        />
        {locked && (
          <>
            <div className='toggle-premium-only'>
              <PremiumOnly />
            </div>
            <div className='toggle-lock'>
              <Lock />
            </div>
          </>
        )}
        <label
          style={{
            background: (on && color) as string,
            transform: `scale(${scale}, ${scale})`,
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
