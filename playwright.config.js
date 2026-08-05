const { defineConfig } = require('@playwright/test');

const FIXTURE_PORT = Number(process.env.FIXTURE_PORT) || 5174;

/**
 * The suite is self-contained: it serves its own fixture pages and mocks every
 * NLP API call (see __tests__/helpers/mockApi.js). It needs no deployed
 * dashboard, no running NLP API, and no test account.
 *
 * Build the extension with TESTING=true before running — `npm run test` does
 * this. Without it the on-install OAuth flow fires and opens an auth window
 * over the fixtures.
 */
module.exports = defineConfig({
  testDir: './__tests__',
  // Extensions need a persistent context, and two contexts loading the same
  // unpacked extension at once interfere with each other.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Antialiasing differs slightly across machines; the threshold absorbs
      // that without hiding a genuinely displaced highlight.
      maxDiffPixels: 300,
    },
  },
  // The HTML report must live outside outputDir, or Playwright refuses to start.
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${FIXTURE_PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node __tests__/fixtures/server.js',
    url: `http://localhost:${FIXTURE_PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
