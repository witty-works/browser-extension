import React, { ChangeEvent } from 'react';

import './styles.scss';

export interface OptionProp {
  key: string;
  value: string;
}

export interface DropdownProps {
  onDropdownChange: (value: string) => void;
  options: OptionProp[];
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
          {option.value.length > 42
            ? option.value.slice(0, 40).concat('...')
            : option.value}
        </option>
      ))}
    </select>
  );
};

export default Dropdown;
