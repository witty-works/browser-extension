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

const stored = (organization?: unknown, own?: unknown) => {
  return {
    ...(organization !== undefined
      ? {confirmBeforeCheckingOrg: organization}
      : {}),
    ...(own !== undefined ? {confirmBeforeChecking: own} : {}),
  };
};

describe('confirmBeforeChecking', () => {
  it('is off by default', () => {
    expect(confirmBeforeChecking(stored())).toEqual({
      enabled: false,
      forced: false,
    });
  });

  it('follows a forced organisation value over the user', () => {
    expect(
      confirmBeforeChecking(stored({value: true, status: 'force'}, false))
    ).toEqual({enabled: true, forced: true});
    expect(
      confirmBeforeChecking(stored({value: false, status: 'force'}, true))
    ).toEqual({enabled: false, forced: true});
  });

  it('lets the user override a suggestion', () => {
    expect(
      confirmBeforeChecking(stored({value: false, status: 'suggestion'}, true))
    ).toEqual({enabled: true, forced: false});
    expect(
      confirmBeforeChecking(stored({value: true, status: 'suggestion'}))
    ).toEqual({enabled: true, forced: false});
  });

  it('takes only a real true as on', () => {
    expect(
      confirmBeforeChecking(stored({value: 'true', status: 'force'}))
    ).toEqual({enabled: false, forced: true});
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
