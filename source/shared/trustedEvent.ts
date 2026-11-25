/**
 * Whether `event` comes from the user rather than from a script.
 *
 * The popover lives in the page's DOM, so the page can dispatch events on its
 * buttons. Actions that change the user's text or write to their dashboard
 * act only on events the browser marks as trusted: a real click, tap or key
 * press (Enter and Space on a focused button are trusted too). A page script's
 * `dispatchEvent` or `click()` is not.
 *
 * Its own module so unit tests, which can only dispatch synthetic events, can
 * stand in for the user.
 */
export const isTrustedEvent = (event: Event): boolean => event.isTrusted;
