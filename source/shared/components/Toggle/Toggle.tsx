import React from 'react';

import './Toggle.scss';

interface ToggleProps {
  on: boolean;
  handleToggle: () => void;
}

const Toggle: React.FC<ToggleProps> = ({ on, handleToggle }: ToggleProps) => {
  return (
    <>
      <input
        checked={on}
        onChange={handleToggle}
        className='toggle-checkbox'
        id={`toggle-new`}
        type='checkbox'
      />
      <label
        style={{ background: on && '#06D6A0' }}
        className='toggle-label'
        htmlFor={`toggle-new`}
      >
        <span className={`toggle-button`} />
      </label>
    </>
  );
};

export default Toggle;
