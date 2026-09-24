import {describe, expect, it} from 'vitest';

import {apiLanguage, apiLocale} from '@witty/core/ApiServices/apiLocale';
import {categoriesPath} from '@witty/core/ApiServices/requests';

describe('apiLocale', () => {
  it.each([
    ['de-CH', 'de-CH'],
    ['en-us', 'en-US'],
    ['fr-CH', 'fr'],
    ['en-AU', 'en'],
    ['de', 'de'],
    ['it-IT', 'en'],
    ['', 'en'],
    [undefined, 'en'],
    // Whatever the browser reports, only allowed values reach the URL.
    ['de-CH/../../x?y', 'de'],
    ['x?y=1', 'en'],
  ])('maps %s to %s', (language, locale) => {
    expect(apiLocale(language)).toBe(locale);
  });
});

describe('apiLanguage', () => {
  it.each([
    ['de-CH', 'de'],
    ['FR', 'fr'],
    ['it-IT', 'en'],
    [undefined, 'en'],
  ])('maps %s to %s', (language, expected) => {
    expect(apiLanguage(language)).toBe(expected);
  });
});

describe('categoriesPath', () => {
  it('asks only for a locale the API accepts', () => {
    // The extension's options page passes the browser's UI language as is.
    expect(categoriesPath('fr-CH')).toBe('v2.0/categories?locale=fr');
    expect(categoriesPath('it')).toBe('v2.0/categories?locale=en');
    expect(categoriesPath('de-CH')).toBe('v2.0/categories?locale=de-CH');
  });
});
