/**
 * ESLint flat config.
 *
 * Replaces .eslintrc.json, which had been dead for some time: it extended
 * @abhijithvijayan/eslint-config, but that package was not in package.json at
 * all, so every `npm run lint` failed to resolve the config before linting a
 * single file. The shared config is a dependency again, at v3 — which is
 * flat-config only, hence this file.
 *
 * Plugin renames that came with it: eslint-plugin-import -> import-x, and
 * eslint-plugin-node -> eslint-plugin-n (so `node/*` rules are now `n/*`).
 *
 * Flat config resolves a rule only in a block where its plugin is registered,
 * so the override blocks below re-register the same plugin instances the
 * shared config uses rather than relying on them leaking across blocks.
 */
import globals from 'globals';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import importXPlugin from 'eslint-plugin-import-x';
import prettierPlugin from 'eslint-plugin-prettier';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import nPlugin from 'eslint-plugin-n';

import typescript from '@abhijithvijayan/eslint-config/typescript';
import node from '@abhijithvijayan/eslint-config/node';
import react from '@abhijithvijayan/eslint-config/react';

const TS = ['**/*.ts', '**/*.tsx'];
const JS = ['**/*.js', '**/*.mjs', '**/*.cjs'];

export default [
  {
    // Flat config has no .eslintignore; ignores live here instead.
    ignores: [
      'node_modules/**',
      'dist/**',
      'extension/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Type-aware linting for the extension source.
  ...typescript({ files: TS, tsconfigPath: './tsconfig.json' }),
  ...react({ files: ['**/*.tsx'] }),

  // Build scripts, the Playwright suite and its fixture server are plain CJS
  // running under Node, not part of the TypeScript program.
  ...node({ files: JS }),

  {
    files: [...TS, ...JS],
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      'import-x': importXPlugin,
      prettier: prettierPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      // The shared config pins its own prettier options inline (notably
      // bracketSpacing: false), which silently outranks this project's
      // .prettierrc. Passing no options hands the decision back to
      // .prettierrc, which is what the codebase is formatted to.
      'prettier/prettier': 'error',

      'no-console': 'off',
      'no-extend-native': 'off',
      'react/jsx-props-no-spreading': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'class-methods-use-this': 'off',
      'max-classes-per-file': 'off',

      // typescript-eslint v8 changed no-unused-vars to report unused `catch`
      // bindings. This codebase names them consistently (`catch (err)`) and
      // often does not need the value; that is a house style, not a defect.
      // ignoreRestSiblings allows the standard "omit a property" idiom,
      // `const {context, ...rest} = result`, where the named binding exists
      // precisely so it is left out of the rest object.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { caughtErrors: 'none', ignoreRestSiblings: true },
      ],

      // Everything below is demoted to a warning rather than switched off:
      // lint was broken for a long time (the shared config was missing from
      // package.json), so none of these has ever actually been enforced and
      // the codebase has hundreds of pre-existing hits. Warnings keep them
      // visible and keep `npm run lint` meaningful for new code, instead of
      // failing the build on a backlog nobody has triaged yet.
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-use-before-define': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-shadow': 'warn',
      'no-param-reassign': 'warn',
      'no-unused-expressions': 'warn',
      'func-names': 'warn',
      'import-x/no-mutable-exports': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/media-has-caption': 'warn',
      'react/button-has-type': 'warn',
      'react/destructuring-assignment': 'warn',
      'react/no-array-index-key': 'warn',
      'react/no-danger': 'warn',

      // react-hooks defaults this to a warning upstream; the shared config
      // raises it to an error. 39 pre-existing hits, several of which need a
      // real behavioural decision rather than a dependency tweak.
      'react-hooks/exhaustive-deps': 'warn',

      // The current hits are all gated on build-time constants (X_KEY,
      // REPHRASE_ENABLED), so hook order is in fact stable within any given
      // build, plus one false positive on `useLog` — a logger factory that
      // merely starts with "use" and is called at service-worker top level.
      // Hoisting the early returns above the hooks would run effects that
      // currently never run (analytics events, storage listeners), so these
      // want a deliberate fix, not a silent one.
      'react-hooks/rules-of-hooks': 'warn',

      // Fires on an array of frames that is indexed one element at a time
      // rather than rendered as a list, so keys would not change anything.
      'react/jsx-key': 'warn',
    },
  },

  {
    // The `n` plugin is only meaningful for the Node-side files, and flat
    // config requires a rule to be configured where its plugin is in scope.
    files: JS,
    plugins: { n: nPlugin },
    languageOptions: {
      globals: { ...globals.node },
    },
    settings: {
      // Append ts/tsx so the resolver follows them too.
      n: { tryExtensions: ['.js', '.json', '.node', '.ts', '.tsx'] },
    },
    rules: {
      // The bundler resolves imports, not Node, so Node's own resolution and
      // published-files checks report on things that are not problems here.
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-unsupported-features/es-syntax': [
        'error',
        { ignores: ['modules'] },
      ],
      'n/prefer-promises/fs': 'warn',
    },
  },

  {
    // Specs are Node on the outside, but the bodies of page.evaluate and
    // waitForFunction are serialised and run in the browser, where browser
    // APIs are exactly what is wanted. The Node-support rules cannot tell the
    // two apart and flag the browser halves as unsupported builtins.
    files: ['__tests__/**/*.js'],
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },

  {
    // This file monkey-patches CanvasRenderingContext2D methods and forwards
    // via `arguments`, so the declared parameters exist only to keep each
    // replacement's `length` equal to the method it stands in for. They are
    // unused by design and must not be removed.
    files: ['source/assets/googleDocsSupport.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
    },
  },
];
