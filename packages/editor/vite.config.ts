import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {defineConfig, type Plugin} from 'vitest/config';
import svgr from 'vite-plugin-svgr';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

import {licenseNotices} from './licenseNotices.ts';

// `vite` serves the demo (index.html); `vite build` produces the embeddable
// bundle: one self-contained dist/witty-editor.js exposing `WittyEditor.mount`.
const fromRoot = (path: string): string =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url));

// The extension's own list of credential fields (build/credentialGuard.js).
const {CREDENTIAL_KEYS} = createRequire(import.meta.url)(
  fromRoot('build/credentialGuard.js')
) as {CREDENTIAL_KEYS: string[]};

const CONFIG_PATH = fromRoot('source/witty.config.json');

const packageVersion = (): string =>
  (
    JSON.parse(
      readFileSync(new URL('package.json', import.meta.url), 'utf8')
    ) as {
      version: string;
    }
  ).version;

/** Which version and commit a copy of the bundle is, wherever it ends up. */
const banner = (): string => {
  const version = packageVersion();
  let commit = process.env.GITHUB_SHA?.slice(0, 8) ?? '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short=8 HEAD').toString().trim();
    } catch (error) {
      commit = 'unknown';
    }
  }
  return `/*! @witty-works/editor ${version} (${commit}) | MIT | https://witty.works | third-party licenses: witty-editor.js.LICENSE.txt */`;
};

/**
 * Keep credentials in witty.config.json out of the bundle.
 *
 * The shared constants import that file whole, and a bundler keeps every field
 * of a default-imported JSON object — so a developer's X_KEY would ship inside
 * witty-editor.js even though production code never reads it. The extension
 * guards its release builds by refusing to build; the editor is always built
 * as production and vendored elsewhere, so it strips the fields instead, and
 * fails the build if any credential value still turns up in the output.
 */
const stripCredentials = (): Plugin => {
  const secrets = (): string[] => {
    try {
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      return CREDENTIAL_KEYS.map((key) => config[key]).filter(
        (value): value is string =>
          typeof value === 'string' && value.trim() !== ''
      );
    } catch (error) {
      return [];
    }
  };

  return {
    name: 'witty-strip-credentials',
    enforce: 'pre',
    load(id): string | null {
      if (id.split('?')[0] !== CONFIG_PATH) return null;
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      for (const key of CREDENTIAL_KEYS) delete config[key];
      return JSON.stringify(config);
    },
    generateBundle(_options, bundle): void {
      const values = secrets();
      for (const output of Object.values(bundle)) {
        const code =
          output.type === 'chunk' ? output.code : String(output.source);
        if (values.some((value) => code.includes(value))) {
          this.error(
            `${output.fileName} contains a credential from witty.config.json`
          );
        }
      }
    },
  };
};

/**
 * Preact in place of React, in the editor's bundle only (the extension keeps
 * React): the shared code is written against React's API and runs on
 * preact/compat unchanged, in 16% less bundle (FEATURE_GAPS.md). The unit
 * tests stay on React: Vitest loads libraries such as react-i18next from
 * node_modules as they are, so they would bring React next to Preact. The
 * browser tests (`npm run test:editor`) run on the bundle, so on Preact.
 */
const PREACT = [
  {find: /^react-dom\/client$/, replacement: 'preact/compat/client'},
  {find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime'},
  {find: /^react-dom$/, replacement: 'preact/compat'},
  {find: /^react$/, replacement: 'preact/compat'},
];

export default defineConfig(({command}) => {
  return {
    // Shared code by name; see "paths" in tsconfig.json, which mirrors this.
    resolve: {
      alias: [
        {find: '@witty/core', replacement: fromRoot('source/shared')},
        {find: '@witty/i18n', replacement: fromRoot('source/i18n')},
        {find: '@witty/assets', replacement: fromRoot('source/assets')},
        {
          find: '@witty/ui',
          replacement: fromRoot('source/ContentScript/HighlightPopover'),
        },
        {
          find: '@witty/test-fixtures',
          replacement: fromRoot('__tests__/helpers'),
        },
        ...(command === 'build' ? PREACT : []),
      ],
    },
    plugins: [
      stripCredentials(),
      licenseNotices(),
      // The shared popover imports its icons as React components, as the
      // extension's @svgr/webpack setup does.
      svgr({include: '**/*.svg', svgrOptions: {exportType: 'default'}}),
      // Its stylesheet ships inside the script, so hosts include one file.
      cssInjectedByJs(),
      // Last, so the banner stays the first line after the CSS injection code
      // has been prepended.
      {
        name: 'witty-banner',
        enforce: 'post',
        generateBundle(_options, bundle): void {
          const text = banner();
          for (const output of Object.values(bundle)) {
            if (output.type === 'chunk')
              output.code = `${text}\n${output.code}`;
          }
        },
      },
    ],
    build: {
      lib: {
        entry: 'src/mount.ts',
        name: 'WittyEditor',
        formats: ['iife'],
        fileName: (): string => 'witty-editor.js',
      },
    },
    // Build-time constants the shared extension code reads. Library mode leaves
    // process.env alone for consumers to set; a script tag has no consumer build
    // step, so resolve them here.
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.TESTING': JSON.stringify('false'),
      // The editor's own version (the release version, see
      // build/releaseVersion.js), sent to the API as `witty-editor:<version>`.
      'process.env.WITTY_VERSION': JSON.stringify(packageVersion()),
    },
    test: {
      environment: 'node',
      // `npm run test:coverage`: fails below these, so coverage cannot slide
      // unnoticed. What stays uncovered needs a real layout engine (clicking a
      // highlight) and is exercised in the browser instead.
      coverage: {
        // lcov for SonarCloud (sonar-project.properties), with paths from the
        // repository root, where it resolves them; text for the console.
        reporter: ['text', 'html', ['lcov', {projectRoot: '../..'}]],
        include: ['src/**'],
        exclude: ['src/**/*.test.ts', 'src/demo.ts'],
        thresholds: {statements: 95, branches: 85, functions: 90, lines: 95},
      },
    },
  };
});
