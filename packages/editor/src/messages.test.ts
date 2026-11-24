// The background's message guard (source/shared/messages.ts): which
// contexts may ask for what.
import {describe, expect, it} from 'vitest';

import {isFromExtensionPage} from '@witty/core/messages';

const ORIGIN = 'chrome-extension://abcdefghijklmnop/';

describe('isFromExtensionPage', () => {
  it('accepts the popup and the options page', () => {
    expect(isFromExtensionPage({url: `${ORIGIN}popup.html`}, ORIGIN)).toBe(
      true
    );
    expect(
      isFromExtensionPage({url: `${ORIGIN}options.html`, tab: {id: 3}}, ORIGIN)
    ).toBe(true);
  });

  it('refuses a content script, which runs in a web page', () => {
    expect(
      isFromExtensionPage(
        {url: 'https://mail.example.com/', tab: {id: 3}},
        ORIGIN
      )
    ).toBe(false);
  });

  it('refuses a sender without a URL', () => {
    expect(isFromExtensionPage({}, ORIGIN)).toBe(false);
  });
});
