import React, { useState, useEffect, ChangeEvent } from 'react';

import './styles.scss';

export interface OptionProp {
  key: string | number;
  value: string;
}

export interface DropdownProps {
  onDropdownChange: (value: string) => void;
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
  const [selected, setSelected] = useState<string | number>('');

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
      disabled={locked}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.value}
        </option>
      ))}
    </select>
  );
};

export default Dropdown;
