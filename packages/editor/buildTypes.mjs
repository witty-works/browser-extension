/**
 * Writes dist/witty-editor.d.ts, the package's type declarations, from the
 * declarations tsc emitted for src/api.ts (tsconfig.api.json): the public
 * types, plus `mount` itself, which both bundles export (the script tag's as
 * `WittyEditor.mount`).
 *
 * api.ts may only import types from @tiptap/core, so the declarations stand on
 * their own; this fails the build if anything else turns up.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const emitted = new URL('dist/.types/api.d.ts', import.meta.url);
const target = new URL('dist/witty-editor.d.ts', import.meta.url);

const declarations = readFileSync(emitted, 'utf8');
// Both forms tsc writes: `import ... from 'x'` and an inline `import('x').T`.
const imports = [
  ...declarations.matchAll(/from\s+['"]([^'"]+)['"]/g),
  ...declarations.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
].map(([, specifier]) => specifier);
const foreign = imports.filter((specifier) => specifier !== '@tiptap/core');
if (foreign.length) {
  throw new Error(
    `src/api.ts must only import types from @tiptap/core, not ${foreign.join(', ')}`
  );
}

writeFileSync(
  target,
  `${declarations}
/** Mount the editor into \`element\`; see the README. */
export declare const mount: Mount;
`
);
rmSync(new URL('dist/.types', import.meta.url), { recursive: true });
