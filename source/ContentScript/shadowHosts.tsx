import {createRoot, Root} from 'react-dom/client';

import {TESTING, WTags} from '../shared/constants';
import popoverStyles from './HighlightPopover/HighlightPopover.scss?inline';
import indicatorStyles from '../shared/StateIndicatorIcons/styles.scss?inline';

/**
 * The elements the content script puts into the page to hold its UI.
 *
 * The page owns the DOM, so anything the extension finds by tag name in it a
 * page script could have put there first, or read. The hosts are created here
 * and only ever reached through the references kept in this module; their
 * shadow roots are closed, so a page script cannot reach the highlights, the
 * popover or the user's text shown in them.
 *
 * Test builds (TESTING) open them, so the e2e suite can look inside, as a page
 * script could not. Release and development builds keep them closed.
 */
export const SHADOW_ROOT_MODE: ShadowRootMode = TESTING ? 'open' : 'closed';

/** The highlight containers created for inputs, with their shadow roots. */
const highlightHosts = new Map<HTMLElement, ShadowRoot>();

/** A host for an input's highlights, with a closed shadow root. */
export const createHighlightHost = (
  doc: Document
): {host: HTMLElement; shadowRoot: ShadowRoot} => {
  const host = doc.createElement(WTags.WW_SHADOW_ROOT_CONTAINER);
  const shadowRoot = host.attachShadow({mode: SHADOW_ROOT_MODE});
  highlightHosts.set(host, shadowRoot);
  return {host, shadowRoot};
};

/** Whether `element` is a highlight host this content script created. */
export const isHighlightHost = (element: Element | null): boolean =>
  !!element && highlightHosts.has(element as HTMLElement);

/** The highlight hosts this content script created, in creation order. */
export const highlightHostList = (): HTMLElement[] => [
  ...highlightHosts.keys(),
];

/** The shadow root of a highlight host, which `host.shadowRoot` hides. */
export const highlightShadowRoot = (host: Element): ShadowRoot | undefined =>
  highlightHosts.get(host as HTMLElement);

export const forgetHighlightHost = (host: Element): void => {
  highlightHosts.delete(host as HTMLElement);
};

let popoverHost: HTMLElement | null = null;
let popoverRoot: Root | null = null;

/**
 * The React root the highlight popover renders into: inside a closed shadow
 * root on a host appended to the body, created on first use and again if the
 * page removed it. Its stylesheet goes with it, as contentScript.css only
 * styles the page's own tree.
 */
export const getPopoverRoot = (): Root => {
  if (popoverHost?.isConnected && popoverRoot) {
    return popoverRoot;
  }
  removePopover();

  const host = document.createElement(WTags.WW_POPOVER);
  const shadowRoot = host.attachShadow({mode: SHADOW_ROOT_MODE});
  const style = document.createElement('style');
  style.textContent = `${popoverStyles}\n${indicatorStyles}`;
  const container = document.createElement('div');
  shadowRoot.append(style, container);
  document.body.appendChild(host);

  popoverHost = host;
  popoverRoot = createRoot(container);
  return popoverRoot;
};

/**
 * Unmount the popover and remove its host. The unmount waits for the current
 * render to finish, as React requires when this runs from inside one.
 */
export const removePopover = (): void => {
  const root = popoverRoot;
  const host = popoverHost;
  popoverRoot = null;
  popoverHost = null;
  if (!root && !host) return;
  setTimeout(() => {
    try {
      root?.unmount();
    } catch (error) {
      // already unmounted
    }
    host?.remove();
  }, 0);
};

/**
 * Whether `node` is the popover or inside it. Focus moving into the closed
 * shadow root reaches the page's listeners retargeted to its host.
 */
export const isInPopover = (node: Node | null): boolean =>
  !!node && !!popoverHost && popoverHost.contains(node);

/** Whether the popover is shown. */
export const isPopoverShown = (): boolean =>
  !!popoverRoot && !!popoverHost?.isConnected;
