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
 * React and accessibility rules come from @eslint-react/eslint-plugin and
 * eslint-plugin-jsx-a11y-x rather than the shared config's react preset: that
 * preset loads eslint-plugin-react and eslint-plugin-jsx-a11y, which do not
 * accept ESLint 10. The block for .tsx files below carries the same rules
 * under their new names, with the shared preset's severities.
 *
 * Flat config resolves a rule only in a block where its plugin is registered,
 * so the override blocks below re-register the same plugin instances the
 * shared config uses rather than relying on them leaking across blocks.
 */
import globals from 'globals';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import importXPlugin from 'eslint-plugin-import-x';
import prettierPlugin from 'eslint-plugin-prettier';
import reactPlugin from '@eslint-react/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y-x';
import nPlugin from 'eslint-plugin-n';

import typescript from '@abhijithvijayan/eslint-config/typescript';
import node from '@abhijithvijayan/eslint-config/node';

const TS = ['**/*.ts', '**/*.tsx'];
const JS = ['**/*.js', '**/*.mjs', '**/*.cjs'];

export default [
  {
    // Flat config has no .eslintignore; ignores live here instead.
    ignores: [
      'node_modules/**',
      'dist/**',
      'packages/*/dist/**',
      'extension/**',
      'coverage/**',
      'playwright-report/**',
      'playwright-report-editor/**',
      'playwright-report-firefox/**',
      'playwright-report-release/**',
      'test-results/**',
      'test-results-editor/**',
      'test-results-firefox/**',
      'test-results-release/**',
      // Type-checked against the built declarations (`npm run test:types`),
      // which only exist after a build.
      'packages/editor/types-test/**',
    ],
  },

  // Type-aware linting for the extension source.
  ...typescript({ files: TS, tsconfigPath: './tsconfig.json' }),
  // Workspace packages are separate TypeScript programs with their own tsconfig.
  {
    files: ['packages/editor/**/*.ts', 'packages/editor/**/*.tsx'],
    languageOptions: {
      parserOptions: { project: './packages/editor/tsconfig.json' },
    },
  },

  // React components. Each rule is the equivalent of one the shared config's
  // react preset (eslint-plugin-react recommended plus its own additions)
  // enables, at the same severity. eslint-plugin-react rules without an
  // equivalent are left out where TypeScript or React 19 already rules the
  // mistake out (duplicate or undefined JSX names, string refs, isMounted,
  // unescaped `>` and `}`) or where they only police class components, of
  // which there are none.
  {
    files: ['**/*.tsx'],
    plugins: {
      '@eslint-react': reactPlugin,
      'jsx-a11y-x': jsxA11yPlugin,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // eslint-plugin-react recommended, as raised by the shared config.
      '@eslint-react/no-missing-component-display-name': 'warn',
      '@eslint-react/no-missing-key': 'error',
      '@eslint-react/jsx-no-comment-textnodes': 'error',
      '@eslint-react/dom-no-unsafe-target-blank': 'error',
      '@eslint-react/jsx-no-children-prop': 'error',
      '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
      '@eslint-react/no-direct-mutation-state': 'error',
      '@eslint-react/dom-no-find-dom-node': 'error',
      '@eslint-react/dom-no-render-return-value': 'error',
      '@eslint-react/dom-no-unknown-property': 'error',
      // react/no-deprecated and react/no-unsafe.
      '@eslint-react/dom-no-render': 'error',
      '@eslint-react/dom-no-hydrate': 'error',
      '@eslint-react/no-component-will-mount': 'error',
      '@eslint-react/no-component-will-receive-props': 'error',
      '@eslint-react/no-component-will-update': 'error',
      '@eslint-react/no-unsafe-component-will-mount': 'error',
      '@eslint-react/no-unsafe-component-will-receive-props': 'error',
      '@eslint-react/no-unsafe-component-will-update': 'error',

      // The shared config's own additions.
      '@eslint-react/dom-no-missing-button-type': 'error',
      '@eslint-react/no-array-index-key': 'error',
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',

      // eslint-plugin-jsx-a11y-x carries eslint-plugin-jsx-a11y's rules under
      // the same names; these are the shared config's choices.
      'jsx-a11y-x/alt-text': 'warn',
      'jsx-a11y-x/anchor-has-content': 'error',
      'jsx-a11y-x/anchor-is-valid': ['warn', { aspects: ['invalidHref'] }],
      'jsx-a11y-x/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y-x/aria-props': 'error',
      'jsx-a11y-x/aria-proptypes': 'error',
      'jsx-a11y-x/aria-role': 'error',
      'jsx-a11y-x/aria-unsupported-elements': 'error',
      'jsx-a11y-x/click-events-have-key-events': 'error',
      'jsx-a11y-x/heading-has-content': 'error',
      'jsx-a11y-x/html-has-lang': 'error',
      'jsx-a11y-x/iframe-has-title': 'error',
      'jsx-a11y-x/img-redundant-alt': 'error',
      'jsx-a11y-x/interactive-supports-focus': 'warn',
      'jsx-a11y-x/lang': 'error',
      'jsx-a11y-x/media-has-caption': 'warn',
      'jsx-a11y-x/mouse-events-have-key-events': 'error',
      'jsx-a11y-x/no-access-key': 'error',
      'jsx-a11y-x/no-distracting-elements': 'error',
      'jsx-a11y-x/no-interactive-element-to-noninteractive-role': 'warn',
      'jsx-a11y-x/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y-x/no-noninteractive-element-to-interactive-role': 'warn',
      'jsx-a11y-x/no-redundant-roles': 'error',
      'jsx-a11y-x/role-has-required-aria-props': 'error',
      'jsx-a11y-x/role-supports-aria-props': 'error',
      'jsx-a11y-x/scope': 'error',
      'jsx-a11y-x/tabindex-no-positive': 'warn',
    },
  },

  // Build scripts, the Playwright suite and its fixture server are plain CJS
  // running under Node, not part of the TypeScript program.
  ...node({ files: JS }),

  {
    files: [...TS, ...JS],
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      'import-x': importXPlugin,
      prettier: prettierPlugin,
      '@eslint-react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y-x': jsxA11yPlugin,
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
      'jsx-a11y-x/click-events-have-key-events': 'warn',
      'jsx-a11y-x/media-has-caption': 'warn',
      '@eslint-react/dom-no-missing-button-type': 'warn',
      '@eslint-react/no-array-index-key': 'warn',
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'warn',

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
      '@eslint-react/no-missing-key': 'warn',
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

  {
    // Test helpers are small closures; annotating each return type is noise.
    files: ['packages/editor/**/*.test.ts'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
];
