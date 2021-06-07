import 'emoji-log';
import {browser} from 'webextension-polyfill-ts';

// browser.runtime.onInstalled.addListener((): void => {
//   console.emoji('🦄', 'extension installed');
// });

async function getActiveTabs() {
    return await browser.tabs.query({ active: true });
}

export {
  getActiveTabs
}