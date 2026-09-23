/**
 * Puppeteer drives only the Firefox smoke suite (__tests__/firefox); Chromium
 * coverage stays on Playwright. Skip the Chrome download, fetch Firefox.
 */
module.exports = {
  chrome: { skipDownload: true },
  firefox: { skipDownload: false },
};
