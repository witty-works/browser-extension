// @vitest-environment happy-dom
// The extension's "ask before checking a field" setting
// (source/shared/confirmBeforeChecking.ts): the organisation's value with
// its status, and the user's own choice.
import {describe, expect, it} from 'vitest';

import {
  authConfirmSetting,
  authRetryDelay,
  confirmBeforeChecking,
  confirmField,
  confirmWrites,
  isFieldConfirmed,
  storageValueChanged,
} from '@witty/core/confirmBeforeChecking';

// As stored once the organisation's answer has arrived (/v2.0/auth).
const stored = (organization?: unknown, own?: unknown) => {
  return {
    confirmBeforeCheckingKnown: true,
    ...(organization !== undefined
      ? {confirmBeforeCheckingOrg: organization}
      : {}),
    ...(own !== undefined ? {confirmBeforeChecking: own} : {}),
  };
};

describe('confirmBeforeChecking', () => {
  it("is pending until the organisation's answer is known", () => {
    // After sign-in, /v2.0/auth has not answered yet: an organisation that
    // forces the setting must not have the first check slip through.
    expect(confirmBeforeChecking({}).pending).toBe(true);
    expect(confirmBeforeChecking(stored()).pending).toBe(false);
  });

  it('is off by default', () => {
    expect(confirmBeforeChecking(stored())).toEqual({
      enabled: false,
      forced: false,
      pending: false,
    });
  });

  it('follows a forced organisation value over the user', () => {
    expect(
      confirmBeforeChecking(stored({value: true, status: 'force'}, false))
    ).toEqual({enabled: true, forced: true, pending: false});
    expect(
      confirmBeforeChecking(stored({value: false, status: 'force'}, true))
    ).toEqual({enabled: false, forced: true, pending: false});
  });

  it('lets the user override a suggestion', () => {
    expect(
      confirmBeforeChecking(stored({value: false, status: 'suggestion'}, true))
    ).toEqual({enabled: true, forced: false, pending: false});
    expect(
      confirmBeforeChecking(stored({value: true, status: 'suggestion'}))
    ).toEqual({enabled: true, forced: false, pending: false});
  });

  it('takes only a real true as on', () => {
    expect(
      confirmBeforeChecking(stored({value: 'true', status: 'force'}))
    ).toEqual({enabled: false, forced: true, pending: false});
  });
});

describe('confirmed fields', () => {
  it('remembers the field element, not one like it', () => {
    const field = document.createElement('textarea');
    expect(isFieldConfirmed(field)).toBe(false);
    confirmField(field);
    expect(isFieldConfirmed(field)).toBe(true);
    expect(isFieldConfirmed(document.createElement('textarea'))).toBe(false);
  });
});

describe('authConfirmSetting', () => {
  const force = {value: true, status: 'force'};
  const suggestion = {value: false, status: 'suggestion'};

  it('takes a forced value from either place', () => {
    // An API key can force it in `config`; an organisation suggestion in
    // `organization_config` must not hide that.
    expect(
      authConfirmSetting({
        organization_config: {confirm_before_checking: suggestion},
        config: {confirm_before_checking: force},
      })
    ).toEqual(force);
  });

  it('prefers the organisation when neither forces', () => {
    expect(
      authConfirmSetting({
        organization_config: {confirm_before_checking: suggestion},
        config: {confirm_before_checking: {value: true, status: 'suggestion'}},
      })
    ).toEqual(suggestion);
  });

  it('is null when the answer has none', () => {
    expect(authConfirmSetting({})).toBeNull();
    expect(authConfirmSetting(undefined)).toBeNull();
  });
});

describe('confirmWrites', () => {
  const forced = {value: true, status: 'force'};
  const answer = {organization_config: {confirm_before_checking: forced}};

  it('marks the answer known after a sign-in whose config hashes are unchanged', () => {
    // logOut resets the marker but not the hashes, so this write must not
    // depend on the hashes having changed.
    expect(
      confirmWrites(
        {confirmBeforeCheckingOrg: null, confirmBeforeCheckingKnown: false},
        answer
      )
    ).toEqual({
      confirmBeforeCheckingOrg: forced,
      confirmBeforeCheckingKnown: true,
    });
  });

  it('writes nothing when the stored values are already the answer', () => {
    // Firefox reports a write of an unchanged value as a change.
    expect(
      confirmWrites(
        {
          confirmBeforeCheckingOrg: {value: true, status: 'force'},
          confirmBeforeCheckingKnown: true,
        },
        answer
      )
    ).toEqual({});
  });
});

describe('storageValueChanged', () => {
  it('is false for a write of an equal value, as Firefox reports one', () => {
    expect(
      storageValueChanged({
        oldValue: {value: true, status: 'force'},
        newValue: {value: true, status: 'force'},
      })
    ).toBe(false);
    expect(storageValueChanged({oldValue: true, newValue: true})).toBe(false);
  });

  it('is true for a new, changed or removed value', () => {
    expect(storageValueChanged({newValue: true})).toBe(true);
    expect(storageValueChanged({oldValue: false, newValue: true})).toBe(true);
    expect(
      storageValueChanged({
        oldValue: {value: true, status: 'force'},
        newValue: {value: true, status: 'suggestion'},
      })
    ).toBe(true);
    expect(storageValueChanged({oldValue: true})).toBe(true);
  });
});

describe('authRetryDelay', () => {
  it('does not retry a refused credential', () => {
    expect(authRetryDelay(401, 0)).toBeNull();
    expect(authRetryDelay(403, 0)).toBeNull();
  });

  it('retries an outage, a rate limit or no answer, backing off to a minute', () => {
    expect(authRetryDelay(503, 0)).toBe(2000);
    expect(authRetryDelay(429, 1)).toBe(4000);
    expect(authRetryDelay(0, 2)).toBe(8000);
    expect(authRetryDelay(500, 10)).toBe(60000);
  });
});
