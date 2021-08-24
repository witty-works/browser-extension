import React, { ChangeEvent } from 'react';

import './styles.scss';

export interface OptionsProp {
  key: string;
  value: string;
}

export interface DropdownProps {
  onDropdownChange: (value: string) => void;
  options: OptionsProp[];
  selectedOption: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  onDropdownChange,
  options,
  selectedOption,
}: DropdownProps) => {
  const handleOptionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    selectedOption = (event.target as HTMLSelectElement).value;
    onDropdownChange(selectedOption);
  };

  return (
    <select onChange={handleOptionChange} value={selectedOption}>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.value.slice(0, 50).concat('...')}
        </option>
      ))}
    </select>
  );
};

export default Dropdown;
