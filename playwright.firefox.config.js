const { defineConfig } = require('@playwright/test');

const base = require('./playwright.config');

/**
 * Firefox smoke suite (__tests__/firefox). Uses the Playwright runner and the
 * same fixture server, but the browser is Firefox driven through Puppeteer —
 * see __tests__/firefox/helpers.js for why.
 *
 * Build the extension with `npm run build:test:firefox` first; `npm run
 * test:firefox` does this.
 */
module.exports = defineConfig({
  ...base,
  testDir: './__tests__/firefox',
  testIgnore: [],
  outputDir: 'test-results-firefox',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-firefox' }],
  ],
});
