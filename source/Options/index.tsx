import * as React from 'react';
import {createRoot} from 'react-dom/client';
import Options from './Options';
import {initI18n} from '../i18n/i18n';
import {registerStorage} from '../shared/platform/storage';
import {webextensionStorage} from '../shared/platform/webextensionStorage';

registerStorage(webextensionStorage);
initI18n();

const container = document.getElementById('options-root');

if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
