/**
 * Messages sent to the background service worker.
 *
 * The extension otherwise coordinates through `browser.storage.local`, but
 * authentication cannot: `browser.identity` is unavailable to content scripts,
 * and running the flow in the popup tears it down as soon as the auth window
 * takes focus. So sign-in is a request the background worker services on the
 * caller's behalf.
 *
 * Note that `browser.runtime.onMessage` also receives messages from other
 * extensions unless `externally_connectable` forbids it, so the handler must
 * validate `sender` before acting — see `source/Background/index.tsx`.
 */
export enum MessageTypes {
  SIGN_IN = 'witty:sign-in',
  SIGN_OUT = 'witty:sign-out',
}

export interface SignInMessage {
  type: MessageTypes.SIGN_IN;
  /** Send the user to the registration page rather than the login page. */
  register: boolean;
}

export interface SignOutMessage {
  type: MessageTypes.SIGN_OUT;
}

export type WittyMessage = SignInMessage | SignOutMessage;

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

  return type === MessageTypes.SIGN_IN || type === MessageTypes.SIGN_OUT;
};
