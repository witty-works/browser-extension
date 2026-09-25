import React, {useState, useEffect} from 'react';

import Select, {components} from 'react-select';

export interface DropdownMultiSelectProps {
  onDropdownChange: (option: OptionProp[]) => void;
  options: OptionProp[];
  selectedOptions: OptionProp[];
  disabled?: boolean;
}

export interface OptionProp {
  value: string;
  label: string;
}

const Option = (props: any) => (
  <div>
    <components.Option {...props}>
      <input type='checkbox' checked={props.isSelected} onChange={() => null} />{' '}
      <label>{props.label}</label>
    </components.Option>
  </div>
);

const DropdownMultiSelect: React.FC<DropdownMultiSelectProps> = ({
  onDropdownChange,
  options,
  selectedOptions,
  disabled = false,
}) => {
  const [selecOptions, setSelecOptions] = useState<OptionProp[]>([]);
  const handleChange = (selectedOption: any) => {
    setSelecOptions(selectedOption);
    onDropdownChange(selectedOption);
  };

  useEffect(() => {
    setSelecOptions(selectedOptions);
  }, [selectedOptions]);

  return (
    <div style={{marginTop: '0.5em'}}>
      <Select
        isMulti
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        components={{
          Option,
        }}
        value={selecOptions}
        options={options}
        onChange={handleChange}
        isDisabled={disabled}
      />
    </div>
  );
};

export default DropdownMultiSelect;
