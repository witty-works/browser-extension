import {defineConfig} from 'vitest/config';

// `vite` serves the demo (index.html); `vite build` produces the embeddable
// bundle: one self-contained dist/witty-editor.js exposing `WittyEditor.mount`.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/mount.ts',
      name: 'WittyEditor',
      formats: ['iife'],
      fileName: () => 'witty-editor.js',
    },
  },
  // Library mode leaves process.env alone for consumers to set; a script tag
  // has no consumer build step, so resolve it here.
  define: {'process.env.NODE_ENV': JSON.stringify('production')},
  test: {
    environment: 'node',
  },
});
