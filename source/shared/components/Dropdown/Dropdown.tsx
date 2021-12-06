import React, { useState, useEffect, ChangeEvent } from 'react';

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
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    setSelected(selectedOption);
  }, [selectedOption]);

  const handleOptionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedOption = (event.target as HTMLSelectElement).value;
    setSelected(selectedOption);
    onDropdownChange(selectedOption);
  };

  return (
    <select
      className='dropdown-select'
      onChange={handleOptionChange}
      value={selected}
    >
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
