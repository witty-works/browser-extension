import React, { ChangeEvent } from 'react';

import './styles.scss';

export interface OptionProp {
  key: string | number;
  value: string;
}

export interface DropdownProps {
  onDropdownChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: OptionProp[];
  selectedOption: string | number;
  locked?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  onDropdownChange,
  options,
  selectedOption,
  locked,
}: DropdownProps) => {
  return (
    <select
      className='dropdown-select'
      onChange={onDropdownChange}
      value={selectedOption}
      disabled={locked}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.value.length > 55
            ? option.value.slice(0, 40).concat('...')
            : option.value}
        </option>
      ))}
    </select>
  );
};

export default Dropdown;
