/**
 * Refuses to produce a shippable build that has credentials compiled into it.
 *
 * Static credentials in `source/witty.config.json` are a local-development and
 * CI convenience. `X_KEY` in particular is a *shared* API key, so anything it
 * is compiled into can be unpacked by whoever installs it.
 *
 * `source/shared/constants.ts` forces all three to empty in release builds, but
 * that only empties the exported constants — witty.config.json is imported as a
 * module, so webpack inlines the entire object and the literal values still sit
 * in the bundle for anyone to read. This check, not that gating, is what keeps
 * credentials out of a shipped build.
 *
 * Lives outside webpack.config.js so it can be tested without running a build.
 */
const fs = require('fs');

const CREDENTIAL_KEYS = ['X_KEY', 'ACCESS_TOKEN', 'REFRESH_TOKEN'];

/** Which credential fields carry a non-blank value. */
const findBakedInCredentials = (config) =>
  CREDENTIAL_KEYS.filter(
    (key) => typeof config[key] === 'string' && config[key].trim() !== ''
  );

/**
 * @throws if this build would ship credentials.
 * @param {{nodeEnv: string, testing: boolean, configPath: string}} options
 */
const assertNoBakedInCredentials = ({ nodeEnv, testing, configPath }) => {
  // Development builds are never distributed, and clearing the config to run
  // one would defeat the point of having it.
  if (nodeEnv !== 'production') {
    return;
  }

  // `build:test` is a production build too, but it is loaded unpacked by
  // Playwright and never published, so it is exempt. Blocking it would mean a
  // developer who keeps X_KEY set for local work cannot run the suite at all.
  //
  // Note this build really does contain the key: witty.config.json is
  // imported as a module, so webpack inlines the whole object and every field
  // survives verbatim, whatever constants.ts does with it afterwards. Do not
  // publish or upload a TESTING build.
  if (testing) {
    return;
  }

  if (!fs.existsSync(configPath)) {
    return;
  }

  const offenders = findBakedInCredentials(
    JSON.parse(fs.readFileSync(configPath, 'utf8'))
  );

  if (offenders.length > 0) {
    throw new Error(
      `Refusing to make a production build: ${offenders.join(', ')} ` +
        `${offenders.length === 1 ? 'is' : 'are'} set in source/witty.config.json. ` +
        `These are test/CI-only credentials and must never be compiled into a ` +
        `build that real users install. Clear them, or build with NODE_ENV=development.`
    );
  }
};

module.exports = {
  CREDENTIAL_KEYS,
  findBakedInCredentials,
  assertNoBakedInCredentials,
};
