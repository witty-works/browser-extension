import browser from 'webextension-polyfill';

import {WittyStorage} from './storage';

/**
 * `WittyStorage` implemented over webextension-polyfill's `browser.storage`
 * (EDITOR_COMPONENT_PLAN.md, Phase 1 item 2). Registered at every bundle
 * entry point — Background, ContentScript, Popup, Options.
 */
const sessionArea = (
  browser.storage as unknown as {session?: WittyStorage['session']}
).session;

export const webextensionStorage: WittyStorage = {
  local: {
    get: (keys) => browser.storage.local.get(keys ?? null),
    set: (items) => browser.storage.local.set(items),
  },
  session: sessionArea
    ? {
        get: (keys) => sessionArea.get(keys ?? null),
        set: (items) => sessionArea.set(items),
      }
    : undefined,
  onChanged: {
    addListener: (callback) => browser.storage.onChanged.addListener(callback),
    removeListener: (callback) =>
      browser.storage.onChanged.removeListener(callback),
  },
};
