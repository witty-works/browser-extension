// @vitest-environment happy-dom
// The extension's own hosts for the highlights and the popover
// (source/ContentScript/shadowHosts.tsx), as a release build makes them.
import {describe, expect, it} from 'vitest';

import {
  createHighlightHost,
  getPopoverRoot,
  highlightShadowRoot,
  isHighlightHost,
  isInPopover,
  isPopoverShown,
  removePopover,
  SHADOW_ROOT_MODE,
} from '../../../source/ContentScript/shadowHosts';

describe('shadow hosts', () => {
  it('are closed outside test builds', () => {
    expect(SHADOW_ROOT_MODE).toBe('closed');
  });

  it('keep the highlight shadow root out of the page’s reach', () => {
    const {host, shadowRoot} = createHighlightHost(document);
    expect(host.shadowRoot).toBeNull();
    expect(highlightShadowRoot(host)).toBe(shadowRoot);
    expect(isHighlightHost(host)).toBe(true);

    // An element the page made with the same tag name is not one.
    const lookalike = document.createElement(host.tagName);
    expect(isHighlightHost(lookalike)).toBe(false);
  });

  it('render the popover in a closed shadow root of their own', async () => {
    // A page-made element with the popover's tag name is not used.
    const planted = document.createElement('ww-popover');
    document.body.append(planted);

    getPopoverRoot();
    const hosts = [...document.querySelectorAll('ww-popover')];
    expect(hosts).toHaveLength(2);
    const host = hosts.find((element) => element !== planted)!;
    expect(host.shadowRoot).toBeNull();
    expect(planted.childNodes).toHaveLength(0);
    expect(isPopoverShown()).toBe(true);
    expect(isInPopover(host)).toBe(true);
    expect(isInPopover(planted)).toBe(false);

    removePopover();
    expect(isPopoverShown()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.isConnected).toBe(false);
    expect(planted.isConnected).toBe(true);
  });
});
