import React from 'react';
import ApiSelector from './ApiSelector';

import './styles.scss';

const Popup: React.FC = () => {
  return (
    <section id='popup'>
      <h2>Welcome to Inclusifier</h2>
      {process.env.NODE_ENV === 'development' ? <ApiSelector /> : null}
    </section>
  );
  // return (
  //   <section id='popup'>
  //     <h2>Options</h2>
  //     <label>Select API:</label>
  //     <Dropdown
  //       onDropdownChange={handleDropdownChange}
  //       options={dropdownOptions}
  //       selectedOption={selectedOption}
  //     />
  //   </section>
  // );
};

export default Popup;
