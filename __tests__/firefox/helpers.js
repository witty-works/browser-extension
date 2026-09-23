const path = require('node:path');
const { test: base, expect } = require('@playwright/test');
const puppeteer = require('puppeteer');

const { SAMPLE_TEXT } = require('../helpers/mockApi');
const {
  PAINTED_PIXELS,
  ALTERNATIVE_BTN,
  FIXTURE_ORIGIN,
  measureWordCenter,
  hasElementWithClass,
} = require('../helpers/extension');

/**
 * Firefox smoke suite harness.
 *
 * Playwright cannot load Firefox extensions (microsoft/playwright#2644), so
 * this drives real Firefox through Puppeteer over WebDriver BiDi, whose
 * `webExtension.install` loads the unpacked build as a temporary add-on. The
 * Playwright runner is kept for the test structure, `expect`, reporting and the
 * fixture web server; only the browser comes from Puppeteer.
 */

const PATH_TO_EXTENSION = path.resolve(
  __dirname,
  '..',
  '..',
  'extension',
  'firefox'
);

const GECKO_ID = '{4b376457-9460-4891-b28a-60499c2e3343}';

/**
 * Firefox assigns each install a random moz-extension:// UUID. Pinning it via
 * `extensions.webextensions.uuids` gives the suite a stable origin, the way the
 * manifest `key` does for Chrome.
 */
const EXTENSION_UUID = '0b0c0d0e-1111-4222-8333-944445555666';
const EXTENSION_ORIGIN = `moz-extension://${EXTENSION_UUID}`;

/**
 * The fixture server answers the NLP API routes under this prefix (see
 * fixtures/server.js). Rather than depend on Puppeteer's Firefox request
 * interception reaching requests made by extension contexts, the extension is
 * pointed at the mock through its custom-endpoint setting.
 */
const MOCK_API = `${FIXTURE_ORIGIN}/mock-api/`;

const launchFirefox = () =>
  puppeteer.launch({
    browser: 'firefox',
    headless: !process.env.HEADED,
    defaultViewport: { width: 1400, height: 900 },
    // Evaluating in moz-extension:// pages is privileged; without this flag
    // BiDi refuses script calls there.
    args: ['-remote-allow-system-access'],
    extraPrefsFirefox: {
      'extensions.webextensions.uuids': JSON.stringify({
        [GECKO_ID]: EXTENSION_UUID,
      }),
      // Route everything except loopback through a dead proxy, so a request
      // that escapes the mock fails instead of reaching a real host. Firefox
      // never proxies localhost, so the fixture server stays reachable.
      'network.proxy.type': 1,
      'network.proxy.http': '127.0.0.1',
      'network.proxy.http_port': 9,
      'network.proxy.ssl': '127.0.0.1',
      'network.proxy.ssl_port': 9,
    },
  });

const poll = async (check, { timeout = 15000, interval = 100 } = {}) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check().catch(() => undefined);
    if (value) return value;
    if (Date.now() > deadline) {
      throw new Error(`poll timed out after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/**
 * Open an extension page such as `popup.html` in a new tab.
 *
 * Firefox does load the page, but BiDi never reports the navigation into the
 * extension process as finished, so `page.goto` would time out every time.
 * Start the navigation without awaiting it and poll the page itself instead.
 */
const openExtensionPage = async (browser, file) => {
  const url = `${EXTENSION_ORIGIN}/${file}`;
  const page = await browser.newPage();
  page.goto(url).catch(() => {});
  await poll(() =>
    page.evaluate(
      (expected) =>
        location.href === expected && document.readyState === 'complete',
      url
    )
  );
  return page;
};

/**
 * Signed-in state without OAuth, mirroring helpers/extension.js `signIn`, plus
 * the custom endpoint that points the extension at the fixture server's mock.
 */
const signIn = async (browser) => {
  const page = await openExtensionPage(browser, 'popup.html');
  await page.evaluate(async (api) => {
    await browser.storage.session?.set({ accessToken: 'fixture-access-token' });
    await browser.storage.local.set({
      apiEndpoint: 'Custom',
      customEndpoint: {
        api,
        dashboard: '',
        posthog_url: '',
        posthog_key: '',
        oauth_client_id: '',
      },
      signedIn: true,
      refreshToken: 'fixture-refresh-token',
      accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
      checkEndpointSuccess: true,
      domains: [],
      organizationDomains: { list: [], type: 'deny' },
      spellChecking: true,
      apiDelay: 0,
    });
  }, MOCK_API);
  await page.close();
};

const openFixture = async (browser, file) => {
  const page = await browser.newPage();
  await page.goto(`${FIXTURE_ORIGIN}/${file}`);
  return page;
};

/** Same settle rule as helpers/extension.js `waitForHighlights`. */
const waitForHighlights = (page, timeout = 15000) =>
  page.waitForFunction(
    `(() => {
      const painted = ${PAINTED_PIXELS};
      const previous = window.__wwPaintedPixels;
      window.__wwPaintedPixels = painted;
      return painted > 0 && painted === previous;
    })()`,
    { timeout, polling: 250 }
  );

const typeAndWaitForHighlights = async (page, text = SAMPLE_TEXT) => {
  await page.click('#editor');
  await page.keyboard.type(text);
  await waitForHighlights(page);
};

const openPopoverForWord = async (page, word) => {
  const target = await page.evaluate(measureWordCenter, word);
  await page.mouse.click(target.x, target.y);
  await page.waitForFunction(hasElementWithClass, { timeout: 15000 }, ALTERNATIVE_BTN);
};

const test = base.extend({
  firefox: async ({}, use) => {
    const browser = await launchFirefox();
    await browser.installExtension(PATH_TO_EXTENSION);
    await use(browser);
    await browser.close();
  },
});

module.exports = {
  test,
  expect,
  signIn,
  openExtensionPage,
  openFixture,
  poll,
  waitForHighlights,
  typeAndWaitForHighlights,
  openPopoverForWord,
  ALTERNATIVE_BTN,
  FIXTURE_ORIGIN,
  PATH_TO_EXTENSION,
};
