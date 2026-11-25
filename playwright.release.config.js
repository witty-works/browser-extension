const { defineConfig } = require('@playwright/test');

const base = require('./playwright.config');

/**
 * The release build's suite (__tests__/release): the extension as users get
 * it, with closed shadow roots. Build with `npm run build:chrome` first; `npm
 * run test:release` does this.
 *
 * The release build goes to the same directory as the test build
 * (extension/chrome), so the other suites need `npm test`, which builds the
 * test build again, rather than a bare `npx playwright test`.
 */
module.exports = defineConfig({
  ...base,
  testDir: './__tests__/release',
  testIgnore: [],
  outputDir: 'test-results-release',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-release' }],
  ],
});
