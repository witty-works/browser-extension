#!/usr/bin/env node
/**
 * One version for the browser extension and the editor package.
 *
 * Git tags are semver:
 *
 *   2.1.0          release:  manifest "2.1.0"  (store listing)
 *                            npm 2.1.0, dist-tag latest
 *   2.1.0-beta.3   beta:     manifest "2.1.0.3", version_name "2.1.0-beta.3"
 *                            (dev listing); npm 2.1.0-beta.3, dist-tag beta
 *
 * Browser manifests only take one to four dot-separated numbers, so a beta's
 * number becomes the fourth component and `version_name` shows the real name.
 * A beta is a pre-release of the version it names: 2.1.0-beta.3 comes before
 * 2.1.0, and the dev listing still only ever sees increasing versions.
 *
 *   node build/releaseVersion.js 2.1.0-beta.3        set it everywhere
 *   node build/releaseVersion.js --check 2.1.0-beta.3  verify (CI, on a tag)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'source', 'manifest.json');
const PACKAGES = [
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'packages', 'editor', 'package.json'),
];
const LOCK = path.join(ROOT, 'package-lock.json');

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

/** What a semver version means for each artifact, or null if it is not one. */
const parseVersion = (version) => {
  const match = VERSION.exec(version);
  if (!match) return null;

  const [, major, minor, patch, beta] = match;
  const release = `${major}.${minor}.${patch}`;
  return {
    version,
    beta: beta !== undefined,
    manifestVersion: beta !== undefined ? `${release}.${beta}` : release,
    distTag: beta !== undefined ? 'beta' : 'latest',
  };
};

const read = (file) => fs.readFileSync(file, 'utf8');

/** The first top-level "version" field, read without reformatting the file. */
const readField = (text, field) =>
  new RegExp(`^  "${field}": "([^"]*)"`, 'm').exec(text)?.[1];

// Line edits rather than JSON round trips: the manifest keeps short arrays on
// one line, which JSON.stringify would expand into a noisy diff.
const setVersion = (file, version) => {
  const text = read(file);
  const next = text.replace(/^( {2}"version": )"[^"]*"/m, `$1"${version}"`);
  if (next === text && readField(text, 'version') !== version) {
    throw new Error(`no top-level "version" in ${file}`);
  }
  fs.writeFileSync(file, next);
};

const setManifest = ({manifestVersion, beta, version}) => {
  setVersion(MANIFEST, manifestVersion);
  let text = read(MANIFEST).replace(/^ {2}"version_name": "[^"]*",\n/m, '');
  if (beta) {
    text = text.replace(
      /^( {2}"version": "[^"]*",\n)/m,
      `$1  "version_name": "${version}",\n`
    );
  }
  fs.writeFileSync(MANIFEST, text);
};

const setLock = (version) => {
  const lock = JSON.parse(read(LOCK));
  lock.version = version;
  lock.packages[''].version = version;
  if (lock.packages['packages/editor']) {
    lock.packages['packages/editor'].version = version;
  }
  fs.writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
};

/** Mismatches between `target` and what the files say, as messages. */
const check = (target) => {
  const problems = [];
  const manifest = read(MANIFEST);
  const manifestVersion = readField(manifest, 'version');
  const versionName = readField(manifest, 'version_name');

  if (manifestVersion !== target.manifestVersion) {
    problems.push(
      `manifest version is ${manifestVersion}, expected ${target.manifestVersion}`
    );
  }
  if (target.beta ? versionName !== target.version : versionName) {
    problems.push(
      `manifest version_name is ${versionName ?? 'absent'}, expected ${
        target.beta ? target.version : 'absent'
      }`
    );
  }
  for (const file of PACKAGES) {
    const found = readField(read(file), 'version');
    if (found !== target.version) {
      problems.push(
        `${path.relative(ROOT, file)} has ${found}, expected ${target.version}`
      );
    }
  }
  return problems;
};

const main = (args) => {
  const checking = args[0] === '--check';
  const input = checking ? args[1] : args[0];
  const target = parseVersion(input || '');
  if (!target) {
    console.error(
      `usage: releaseVersion.js [--check] <x.y.z | x.y.z-beta.n>, got "${input}"`
    );
    return 1;
  }

  if (checking) {
    const problems = check(target);
    problems.forEach((problem) => console.error(problem));
    if (!problems.length) {
      console.log(`${target.version}: files agree (npm dist-tag ${target.distTag})`);
    }
    return problems.length ? 1 : 0;
  }

  setManifest(target);
  PACKAGES.forEach((file) => setVersion(file, target.version));
  setLock(target.version);
  console.log(
    `set ${target.version} (manifest ${target.manifestVersion}, npm dist-tag ${target.distTag})`
  );
  return 0;
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {parseVersion, check};
