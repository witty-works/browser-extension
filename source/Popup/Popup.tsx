import React, { useState } from 'react';
import ApiSelector from './ApiSelector';
import Toggle from '../shared/components/Toggle/Toggle';
import { DEV_ENV } from '../shared/constants';

import './styles.scss';

const Popup: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);
  return (
    <section id='popup'>
      <h2>Welcome to Inclusifier</h2>
      <Toggle on={enabled} handleToggle={() => setEnabled(!enabled)} />
      {DEV_ENV ? <ApiSelector /> : null}
    </section>
  );
};

export default Popup;
