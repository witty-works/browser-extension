/**
 * Messages exchanged with the background service worker.
 *
 * The extension otherwise coordinates through `browser.storage.local`, but
 * some things cannot: `browser.identity` is unavailable to content scripts,
 * and running the flow in the popup tears it down as soon as the auth window
 * takes focus. So sign-in is a request the background worker services on the
 * caller's behalf. `browser.commands` likewise only fires in the background,
 * so keyboard shortcuts are forwarded to the content script as messages.
 *
 * Note that `browser.runtime.onMessage` also receives messages from other
 * extensions unless `externally_connectable` forbids it, so the handler must
 * validate `sender` before acting — see `source/Background/index.tsx`.
 */
export enum MessageTypes {
  SIGN_IN = 'witty:sign-in',
  SIGN_OUT = 'witty:sign-out',
  OPEN_POPOVER = 'witty:open-popover',
}

/**
 * Manifest `commands` key of the shortcut that opens/advances the highlight
 * popover. Must match `source/manifest.json`.
 */
export const OPEN_POPOVER_COMMAND = 'open-highlight-popover';

export interface SignInMessage {
  type: MessageTypes.SIGN_IN;
  /** Send the user to the registration page rather than the login page. */
  register: boolean;
}

export interface SignOutMessage {
  type: MessageTypes.SIGN_OUT;
}

/**
 * Sent by the background worker to the content scripts of the active tab when
 * the user presses the "open highlight popover" keyboard shortcut. Opens the
 * popover on the first alert, or advances to the next one if already open.
 */
export interface OpenPopoverMessage {
  type: MessageTypes.OPEN_POPOVER;
}

export type WittyMessage = SignInMessage | SignOutMessage | OpenPopoverMessage;

export interface SignInResult {
  status: 'success' | 'cancelled' | 'error';
  /** Present only when status is 'error'; safe to show to the user. */
  message?: string;
}

export const isWittyMessage = (value: unknown): value is WittyMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const type = (value as {type?: unknown}).type;

  return (
    type === MessageTypes.SIGN_IN ||
    type === MessageTypes.SIGN_OUT ||
    type === MessageTypes.OPEN_POPOVER
  );
};
