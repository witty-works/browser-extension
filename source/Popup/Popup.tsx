import * as React from 'react';
import { browser, Tabs } from 'webextension-polyfill-ts';

import './styles.scss';

function openWebPage(url: string): Promise<Tabs.Tab> {
  return browser.tabs.create({ url });
}

const Popup: React.FC = () => {
  const manifest = browser.runtime.getManifest();
  console.log(manifest.name);

  return (
    <section id='popup'>
      <h2>Hello! This is {manifest.name}!</h2>
      <button
        id='options__button'
        type='button'
        onClick={(): Promise<Tabs.Tab> => {
          return openWebPage('options.html');
        }}
      >
        Options Page
      </button>
    </section>
  );
};

export default Popup;
