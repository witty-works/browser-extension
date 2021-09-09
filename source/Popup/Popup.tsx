import React from 'react';
import ApiSelector from './ApiSelector';
import { DEV_ENV } from '../shared/constants';

import './styles.scss';

const Popup: React.FC = () => {
  return (
    <section id='popup'>
      <h2>Welcome to Inclusifier</h2>
      {DEV_ENV ? <ApiSelector /> : null}
    </section>
  );
};

export default Popup;
