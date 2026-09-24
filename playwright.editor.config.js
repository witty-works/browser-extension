const { defineConfig } = require('@playwright/test');

const base = require('./playwright.config');

/**
 * Browser tests of the editor package (__tests__/editor): the published bundle
 * on a fixture page, against the fixture server's mock API. They cover what
 * the unit tests' happy-dom cannot, such as opening the popover by clicking a
 * highlight, which needs a real layout engine.
 *
 * Build the editor first (`npm run build -w @witty-works/editor`); `npm run
 * test:editor` does this. No extension is loaded, so the tests run headless.
 */
module.exports = defineConfig({
  ...base,
  testDir: './__tests__/editor',
  testIgnore: [],
  outputDir: 'test-results-editor',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-editor' }],
  ],
});
