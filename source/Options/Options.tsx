import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import './styles.scss';

const Options: React.FC = () => {
  const manifest = browser.runtime.getManifest();

  return <div>Hi from {manifest.name} options!</div>;
};

export default Options;
