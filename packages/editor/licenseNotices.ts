import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Plugin} from 'vite';

/**
 * Third-party license notices for everything bundled into witty-editor.js.
 *
 * The bundle includes React, TipTap, ProseMirror, i18next and others; their
 * licenses (MIT, BSD, Apache-2.0) require the copyright and license text to
 * accompany every copy. This writes them to `<bundle>.LICENSE.txt`, next to
 * the bundle, from the packages the bundler actually used, and fails the build
 * if one of them is not under a license on the allowlist.
 */

/** Licenses that permit bundling into an MIT-licensed, public package. */
const ALLOWED = new Set([
  'MIT',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
]);

const LICENSE_FILE = /^(licen[cs]e|copying|notice)/i;

interface PackageNotice {
  name: string;
  version: string;
  license: string;
  texts: string[];
}

/** The package directory a bundled module belongs to, if it is a package. */
const packageDir = (moduleId: string): string | null => {
  const path = moduleId.split('?')[0].replace(/\\/g, '/');
  const index = path.lastIndexOf('/node_modules/');
  if (index === -1) return null;
  const rest = path.slice(index + '/node_modules/'.length).split('/');
  const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
  return `${path.slice(0, index)}/node_modules/${name}`;
};

/** SPDX identifiers in a license expression like "(BSD-3-Clause AND Apache-2.0)". */
const licenseIds = (expression: string): string[] =>
  expression
    .replace(/[()]/g, ' ')
    .split(/\s+(?:AND|OR)\s+|\s+/)
    .filter(Boolean);

const readNotice = (dir: string): PackageNotice => {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    license?: string;
    author?: string | {name?: string};
    repository?: string | {url?: string};
    homepage?: string;
  };
  const texts = readdirSync(dir)
    .filter((file) => LICENSE_FILE.test(file))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8').trim());

  if (!texts.length) {
    // Some packages declare a license without shipping its text; name the
    // declared license and author so the notice is at least traceable.
    const author =
      typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
    const source =
      typeof pkg.repository === 'string'
        ? pkg.repository
        : (pkg.repository?.url ?? pkg.homepage);
    texts.push(
      [
        `No license file in the package. Declared license: ${pkg.license}.`,
        author && `Author: ${author}.`,
        source && `Source: ${source}`,
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  return {
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? 'UNKNOWN',
    texts,
  };
};

export const licenseNotices = (): Plugin => {
  return {
    name: 'witty-license-notices',
    enforce: 'post',
    generateBundle(_options, bundle): void {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;

        const notices = new Map<string, PackageNotice>();
        for (const id of output.moduleIds) {
          const dir = packageDir(id);
          if (!dir) continue;
          const notice = readNotice(dir);
          notices.set(`${notice.name}@${notice.version}`, notice);
        }

        const disallowed = [...notices.values()].filter(
          (notice) => !licenseIds(notice.license).every((id) => ALLOWED.has(id))
        );
        if (disallowed.length) {
          this.error(
            `bundled packages with licenses outside the allowlist: ${disallowed
              .map(
                (notice) =>
                  `${notice.name}@${notice.version} (${notice.license})`
              )
              .join(', ')}`
          );
        }

        const sorted = [...notices.values()].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        const sections = sorted.map((notice) =>
          [
            `${notice.name} ${notice.version} (${notice.license})`,
            '-'.repeat(72),
            notice.texts.join('\n\n'),
          ].join('\n')
        );

        this.emitFile({
          type: 'asset',
          fileName: `${output.fileName}.LICENSE.txt`,
          source: [
            `Third-party software bundled into ${output.fileName}`,
            `(@witty-works/editor, itself MIT licensed; see LICENSE).`,
            `${sorted.length} packages.`,
            '',
            sections.join(`\n\n${'='.repeat(72)}\n\n`),
            '',
          ].join('\n'),
        });
      }
    },
  };
};
