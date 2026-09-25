const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const {
  CREDENTIAL_KEYS,
  findBakedInCredentials,
  assertNoBakedInCredentials,
} = require('../build/credentialGuard');

/**
 * The build-time check that stops credentials being compiled into a published
 * extension.
 *
 * This matters more than it looks: witty.config.json is imported as a module,
 * so webpack inlines the whole object into the bundle. constants.ts empties the
 * exported constants but not the inlined literals, which means this guard — not
 * that gating — is the only thing keeping a shared API key out of something
 * users can unpack.
 *
 * These are plain Node tests; they need no browser and no built extension.
 */

/** Write a witty.config.json-shaped file and return its path. */
const writeConfig = (fields) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'witty-guard-'));
  const file = path.join(dir, 'witty.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      X_KEY: '',
      ACCESS_TOKEN: '',
      REFRESH_TOKEN: '',
      API_ENDPOINT: 'https://example.com/',
      ...fields,
    })
  );
  return file;
};

const runGuard = (fields, options = {}) =>
  assertNoBakedInCredentials({
    nodeEnv: 'production',
    testing: false,
    configPath: writeConfig(fields),
    ...options,
  });

test.describe('credential guard', () => {
  for (const key of CREDENTIAL_KEYS) {
    test(`refuses a production build with ${key} set`, () => {
      expect(() => runGuard({ [key]: 'secret-value' })).toThrow(
        /Refusing to make a production build/
      );
      // The developer has to be told which field to clear.
      expect(() => runGuard({ [key]: 'secret-value' })).toThrow(
        new RegExp(key)
      );
    });
  }

  test('names every offending field, not just the first', () => {
    let message = '';
    try {
      runGuard({ X_KEY: 'a', ACCESS_TOKEN: 'b', REFRESH_TOKEN: 'c' });
    } catch (error) {
      message = error.message;
    }

    for (const key of CREDENTIAL_KEYS) {
      expect(message).toContain(key);
    }
  });

  test('allows a production build once the credentials are cleared', () => {
    expect(() => runGuard({})).not.toThrow();
  });

  test('treats a whitespace-only value as cleared', () => {
    expect(() => runGuard({ X_KEY: '   ' })).not.toThrow();
  });

  test('ignores non-string values rather than crashing on them', () => {
    // A hand-edited config can hold anything; the guard must not throw a
    // TypeError and be mistaken for a credential failure.
    expect(() => runGuard({ X_KEY: null })).not.toThrow();
    expect(() => runGuard({ X_KEY: 0 })).not.toThrow();
  });

  test('does not block development builds', () => {
    expect(() =>
      runGuard({ X_KEY: 'secret-value' }, { nodeEnv: 'development' })
    ).not.toThrow();
  });

  test('exempts TESTING builds, which are never published', () => {
    // build:test runs at NODE_ENV=production, so without this a developer who
    // keeps X_KEY set for local work could not run the suite at all.
    expect(() =>
      runGuard({ X_KEY: 'secret-value' }, { testing: true })
    ).not.toThrow();
  });

  test('does not fail a build that has no config file at all', () => {
    expect(() =>
      assertNoBakedInCredentials({
        nodeEnv: 'production',
        testing: false,
        configPath: path.join(os.tmpdir(), 'witty-guard-absent.json'),
      })
    ).not.toThrow();
  });

  test('findBakedInCredentials reports only the offending keys', () => {
    expect(
      findBakedInCredentials({ X_KEY: 'a', ACCESS_TOKEN: '', OTHER: 'b' })
    ).toEqual(['X_KEY']);
  });

  test('webpack.config.js still invokes the guard', () => {
    // The unit tests above pass whether or not the build actually calls this,
    // so pin the wiring: deleting the call is the failure mode that would
    // silently ship a key.
    const config = fs.readFileSync(
      path.join(__dirname, '..', 'webpack.config.js'),
      'utf8'
    );
    expect(config).toContain("require('./build/credentialGuard')");
    expect(config).toMatch(/assertNoBakedInCredentials\(\{/);
  });
});
