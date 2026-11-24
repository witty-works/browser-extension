import {ConfigPropertyStatus, StorageKeys} from './constants';
import {ConfigProperty} from './types';

/**
 * "Ask before checking a field": the extension sends no text from a field
 * until the user confirms that field (ContentScript/ConfirmCheckPrompt.tsx).
 *
 * The organisation's setting arrives with `/v2.0/auth` as `{value, status}`.
 * With status `force` it decides; with `suggestion` it is the default the
 * user's own choice on the options page overrides.
 */
export interface ConfirmBeforeChecking {
  enabled: boolean;
  /** The organisation forces the value; the user cannot change it. */
  forced: boolean;
  /**
   * The organisation's answer has not arrived since sign-in (`/v2.0/auth`
   * stores it). Until it has, nothing is sent and nothing is asked, so a
   * forced setting holds from the first check on.
   */
  pending: boolean;
}

export const confirmBeforeChecking = (
  result: Record<string, unknown>
): ConfirmBeforeChecking => {
  const pending = result?.[StorageKeys.CONFIRM_BEFORE_CHECKING_KNOWN] !== true;
  const organization = result?.[StorageKeys.CONFIRM_BEFORE_CHECKING_ORG] as
    ConfigProperty | undefined;
  const forced = organization?.status === ConfigPropertyStatus.FORCE;
  if (forced) {
    return {enabled: organization?.value === true, forced, pending};
  }
  const own = result?.[StorageKeys.CONFIRM_BEFORE_CHECKING];
  return {
    enabled: typeof own === 'boolean' ? own : organization?.value === true,
    forced: false,
    pending,
  };
};

/**
 * The fields the user confirmed on this page. Held by reference, so it lasts
 * as long as the element and the page, and a page cannot add to it.
 */
const confirmedFields = new WeakSet<Element>();

export const confirmField = (field: Element): void => {
  confirmedFields.add(field);
};

export const isFieldConfirmed = (field: Element): boolean =>
  confirmedFields.has(field);
