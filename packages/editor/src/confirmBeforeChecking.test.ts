// @vitest-environment happy-dom
// The extension's "ask before checking a field" setting
// (source/shared/confirmBeforeChecking.ts): the organisation's value with
// its status, and the user's own choice.
import {describe, expect, it} from 'vitest';

import {
  confirmBeforeChecking,
  confirmField,
  isFieldConfirmed,
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
