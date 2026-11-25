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
  REFRESH_TOKEN = 'witty:refresh-token',
  API_REQUEST = 'witty:api-request',
  API_CANCEL = 'witty:api-cancel',
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
 * Sent by a content script or the popup when a request was refused with
 * `failedToken`. The background refreshes once for all callers and answers
 * with a `RefreshOutcome` (see `getNewAccessToken`).
 */
export interface RefreshTokenMessage {
  type: MessageTypes.REFRESH_TOKEN;
  failedToken: string;
}

/**
 * The API requests a content script asks the background to make. The
 * background picks the endpoint, path and credentials; the content script
 * only says which request and with what data, and never holds the token.
 */
export const API_REQUEST_KINDS = [
  'check',
  'auth',
  'rephrase',
  'ignoreWord',
] as const;
export type ApiRequestKind = (typeof API_REQUEST_KINDS)[number];

export interface ApiRequestMessage {
  type: MessageTypes.API_REQUEST;
  kind: ApiRequestKind;
  /** The JSON body, for `check` and `rephrase`. */
  body?: Record<string, unknown>;
  /** The term, for `ignoreWord`. */
  term?: string;
  /** Set when the sender may cancel the request (ApiCancelMessage). */
  requestId?: string;
}

/**
 * Cancels an API request the content script no longer needs: a check of text
 * that changed since, a rephrasing the user closed. Each one, above all a
 * rephrasing, costs the API a model call.
 */
export interface ApiCancelMessage {
  type: MessageTypes.API_CANCEL;
  requestId: string;
}

/** What the background answers an ApiRequestMessage with. */
export interface ApiResponse {
  ok: boolean;
  /** The HTTP status, or 0 when no response arrived. */
  status: number;
  statusText: string;
  /** The parsed JSON body of a successful response, else null. */
  data: unknown;
}

/** Longest ignore term accepted; dashboard terms are words or short phrases. */
const MAX_TERM_LENGTH = 200;

/** Longest request id accepted; the content script sends a UUID (36). */
const MAX_REQUEST_ID_LENGTH = 64;

const isRequestId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_REQUEST_ID_LENGTH;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

const isApiRequest = (value: Record<string, unknown>): boolean => {
  const {kind, body, term, requestId} = value;
  if (!(API_REQUEST_KINDS as readonly unknown[]).includes(kind)) return false;
  if (requestId !== undefined && !isRequestId(requestId)) return false;
  if (kind === 'check' || kind === 'rephrase') return isPlainObject(body);
  if (kind === 'ignoreWord') {
    return (
      typeof term === 'string' &&
      term.length > 0 &&
      term.length <= MAX_TERM_LENGTH
    );
  }
  return true;
};

/**
 * Sent by the background worker to the content scripts of the active tab when
 * the user presses the "open highlight popover" keyboard shortcut. Opens the
 * popover on the first alert, or advances to the next one if already open.
 */
export interface OpenPopoverMessage {
  type: MessageTypes.OPEN_POPOVER;
}

export type WittyMessage =
  | SignInMessage
  | SignOutMessage
  | RefreshTokenMessage
  | ApiRequestMessage
  | ApiCancelMessage
  | OpenPopoverMessage;

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

  if (type === MessageTypes.API_REQUEST) {
    return isApiRequest(value as Record<string, unknown>);
  }

  if (type === MessageTypes.API_CANCEL) {
    return isRequestId((value as {requestId?: unknown}).requestId);
  }

  if (type === MessageTypes.REFRESH_TOKEN) {
    return typeof (value as {failedToken?: unknown}).failedToken === 'string';
  }

  return (
    type === MessageTypes.SIGN_IN ||
    type === MessageTypes.SIGN_OUT ||
    type === MessageTypes.OPEN_POPOVER
  );
};

/**
 * Whether a message comes from one of the extension's own pages (the popup,
 * the options page), not from a content script running in a web page.
 * `sender.tab` cannot tell: the options page opens in a tab.
 */
export const isFromExtensionPage = (
  sender: {url?: string; tab?: unknown},
  extensionOrigin: string
): boolean =>
  typeof sender.url === 'string' && sender.url.startsWith(extensionOrigin);
