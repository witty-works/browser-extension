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
 * The setting from a `/v2.0/auth` answer: the organisation's
 * (`organization_config`) or the credential's own (`config`, which an API key
 * can force). A forced one wins wherever it is, so an organisation's mere
 * suggestion cannot hide a key's force; otherwise the organisation's.
 */
export const authConfirmSetting = (
  response: unknown
): ConfigProperty | null => {
  const answer = (response ?? {}) as {
    organization_config?: {confirm_before_checking?: ConfigProperty};
    config?: {confirm_before_checking?: ConfigProperty};
  };
  const organization = answer.organization_config?.confirm_before_checking;
  const own = answer.config?.confirm_before_checking;
  for (const candidate of [organization, own]) {
    if (candidate?.status === ConfigPropertyStatus.FORCE) return candidate;
  }
  return organization ?? own ?? null;
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

const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What a `/v2.0/auth` answer changes in storage for ask-before-checking.
 * Written whatever the config hashes say: signing out resets the marker but
 * not the hashes, so signing in again with the same account would otherwise
 * leave the setting pending. Only values that differ are written, because
 * Firefox reports a write of an unchanged value as a change.
 */
export const confirmWrites = (
  stored: Record<string, unknown>,
  response: unknown
): Record<string, unknown> => {
  const writes: Record<string, unknown> = {};
  const setting = authConfirmSetting(response);
  if (!sameValue(stored?.[StorageKeys.CONFIRM_BEFORE_CHECKING_ORG], setting)) {
    writes[StorageKeys.CONFIRM_BEFORE_CHECKING_ORG] = setting;
  }
  if (stored?.[StorageKeys.CONFIRM_BEFORE_CHECKING_KNOWN] !== true) {
    writes[StorageKeys.CONFIRM_BEFORE_CHECKING_KNOWN] = true;
  }
  return writes;
};

/**
 * How long to wait before asking `/v2.0/auth` again after `status` (0 for no
 * answer), on the `attempt`th retry; null when a retry cannot help, because
 * the credential was refused. Until an answer arrives, ask-before-checking is
 * pending and the tab checks nothing, so an outage is retried.
 */
export const authRetryDelay = (
  status: number,
  attempt: number
): number | null => {
  if (status === 401 || status === 403) return null;
  return Math.min(60000, 2000 * 2 ** attempt);
};
