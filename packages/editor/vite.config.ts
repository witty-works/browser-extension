import {defineConfig} from 'vitest/config';
import svgr from 'vite-plugin-svgr';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

// `vite` serves the demo (index.html); `vite build` produces the embeddable
// bundle: one self-contained dist/witty-editor.js exposing `WittyEditor.mount`.
export default defineConfig({
  plugins: [
    // The shared popover imports its icons as React components, as the
    // extension's @svgr/webpack setup does.
    svgr({include: '**/*.svg', svgrOptions: {exportType: 'default'}}),
    // Its stylesheet ships inside the script, so hosts include one file.
    cssInjectedByJs(),
  ],
  build: {
    lib: {
      entry: 'src/mount.ts',
      name: 'WittyEditor',
      formats: ['iife'],
      fileName: () => 'witty-editor.js',
    },
  },
  // Build-time constants the shared extension code reads. Library mode leaves
  // process.env alone for consumers to set; a script tag has no consumer build
  // step, so resolve them here.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.TESTING': JSON.stringify('false'),
    'process.env.WITTY_VERSION': JSON.stringify('editor-0.0.0'),
  },
  test: {
    environment: 'node',
  },
});
