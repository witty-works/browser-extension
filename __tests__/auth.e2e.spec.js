const { test: base, chromium, expect } = require('@playwright/test');

// Reuse the helper's resolved path rather than recomputing it: this file sits
// one directory shallower, so a copied path.resolve() pointed outside the repo
// and silently launched Chromium with no extension at all.
const { PATH_TO_EXTENSION } = require('./helpers/extension');

/**
 * End-to-end OAuth sign-in against a REAL dashboard.
 *
 * Unlike the rest of the suite this is **not** standalone: it needs a running
 * dashboard with the extension's PKCE client provisioned, plus a login it can
 * use. It is therefore opt-in and skipped by default, so `npm run test` stays
 * offline and deterministic.
 *
 *   E2E_DASHBOARD=https://dashboard.lndo.site/ \
 *   E2E_EMAIL=someone@example.com \
 *   E2E_PASSWORD=secret \
 *   npx playwright test __tests__/auth.e2e.spec.js
 *
 * The dashboard must have the extension's redirect URI registered on the
 * client, byte-for-byte:
 *   https://meojhlodfiihbjkcnehkdcgncnhgagog.chromiumapp.org/
 * and `oauth_client_id` must be set on the matching BASE_URLS entry in
 * witty.config.json (the `Local` entry, which this test selects).
 */

const DASHBOARD = process.env.E2E_DASHBOARD;
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const test = base.extend({
  context: async ({}, use) => {
    // Deliberately no request blocking or API mocking here: the whole point is
    // to talk to a real authorization server.
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      viewport: { width: 1400, height: 900 },
      ignoreHTTPSErrors: true,
      args: [
        `--disable-extensions-except=${PATH_TO_EXTENSION}`,
        `--load-extension=${PATH_TO_EXTENSION}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

test.skip(
  !DASHBOARD || !EMAIL || !PASSWORD,
  'set E2E_DASHBOARD, E2E_EMAIL and E2E_PASSWORD to run the live OAuth test'
);

test.describe('OAuth sign-in (live dashboard)', () => {
  test('completes the PKCE flow and keeps the access token off disk', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Point the extension at the deployment whose client we registered, and
    // start from a clean slate.
    await page.evaluate(async () => {
      await chrome.storage.session?.set({ accessToken: '' });
      await chrome.storage.local.set({
        apiEndpoint: 'Local',
        signedIn: false,
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: 0,
        checkEndpointSuccess: false,
      });
    });

    // launchWebAuthFlow opens its own window; grab it as it appears.
    const authPagePromise = context.waitForEvent('page', { timeout: 30_000 });

    const signInResult = page.evaluate(() =>
      chrome.runtime.sendMessage({ type: 'witty:sign-in', register: false })
    );

    const authPage = await authPagePromise;
    await authPage.waitForLoadState('domcontentloaded');

    // Fortify login form.
    await authPage.fill('input[name="email"]', process.env.E2E_EMAIL);
    await authPage.fill('input[name="password"]', process.env.E2E_PASSWORD);
    await authPage.press('input[name="password"]', 'Enter');

    // Passport may show a consent screen for a public client; approve it if so.
    try {
      const approve = authPage.locator('button:has-text("Authorize")');
      await approve.waitFor({ timeout: 5_000 });
      await approve.click();
    } catch (error) {
      // No consent screen (first-party client is often auto-approved).
    }

    expect(await signInResult).toEqual({ status: 'success' });

    // --- the security property this whole storage split exists for ---
    const stored = await page.evaluate(async () => ({
      local: await chrome.storage.local.get(null),
      session: await chrome.storage.session.get(null),
    }));

    // The bearer token must never be written to disk.
    expect(stored.local.accessToken || '').toBe('');
    // It lives in session storage instead, and looks like a Passport RS256 JWT.
    expect(stored.session.accessToken).toMatch(/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/);
    // The refresh token does persist — otherwise every restart would force an
    // interactive sign-in.
    expect(stored.local.refreshToken).toBeTruthy();
    expect(stored.local.signedIn).toBe(true);
    expect(stored.local.accessTokenExpiresAt).toBeGreaterThan(Date.now());
  });

  test('refresh_token grant returns a new token pair', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.evaluate(async () => {
      await chrome.storage.local.set({ apiEndpoint: 'Local' });
    });

    // Sign in first so there is a refresh token to exchange.
    const authPagePromise = context.waitForEvent('page', { timeout: 30_000 });
    const signIn = page.evaluate(() =>
      chrome.runtime.sendMessage({ type: 'witty:sign-in', register: false })
    );
    const authPage = await authPagePromise;
    await authPage.waitForLoadState('domcontentloaded');
    await authPage.fill('input[name="email"]', process.env.E2E_EMAIL);
    await authPage.fill('input[name="password"]', process.env.E2E_PASSWORD);
    await authPage.press('input[name="password"]', 'Enter');
    try {
      const approve = authPage.locator('button:has-text("Authorize")');
      await approve.waitFor({ timeout: 5_000 });
      await approve.click();
    } catch (error) {
      // no consent screen
    }
    expect(await signIn).toEqual({ status: 'success' });

    const before = await page.evaluate(async () => ({
      refresh: (await chrome.storage.local.get('refreshToken')).refreshToken,
      access: (await chrome.storage.session.get('accessToken')).accessToken,
    }));

    // Drive the extension's own refresh path from the service worker.
    const worker = context.serviceWorkers()[0];
    await worker.evaluate(() => self.__wittyTestRefresh?.());

    await page.waitForTimeout(3000);

    const after = await page.evaluate(async () => ({
      refresh: (await chrome.storage.local.get('refreshToken')).refreshToken,
      access: (await chrome.storage.session.get('accessToken')).accessToken,
    }));

    // Passport rotates refresh tokens, so both values must have changed and
    // both must still be present.
    expect(after.access).toBeTruthy();
    expect(after.refresh).toBeTruthy();
    expect(after.access).not.toBe(before.access);
    expect(after.refresh).not.toBe(before.refresh);
  });
});
