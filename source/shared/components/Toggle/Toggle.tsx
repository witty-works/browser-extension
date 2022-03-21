import React from 'react';

import './Toggle.scss';

interface ToggleProps {
  on: boolean | undefined;
  handleToggle: () => void;
  color: string;
  scale: number;
  label: string;
}

const Toggle: React.FC<ToggleProps> = ({
  on,
  handleToggle,
  color,
  scale,
  label,
}: ToggleProps) => {
  return (
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
        id={`toggle`}
        type='checkbox'
      />
      <label
        style={{
          background: (on && color) as string,
          transform: `scale(${scale}, ${scale})`,
        }}
        className='toggle-encloser'
        htmlFor={`toggle`}
      >
        <span className={`toggle-button`} />
      </label>
    </div>
  );
};

export default Toggle;
