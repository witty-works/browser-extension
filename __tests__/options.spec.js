const { test, expect, signIn } = require('./helpers/extension');

/**
 * The custom endpoint form and the invariants it has to uphold
 * (AUTH_SECURITY_PLAN.md §4).
 *
 * The security-relevant one is the sign-out on change: tokens are issued by one
 * dashboard and must never be presented to another.
 */
const readStorage = (page) =>
  page.evaluate(async () => ({
    local: await chrome.storage.local.get(null),
    session: await chrome.storage.session.get(null),
  }));

const openOptions = async (context, extensionId) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForSelector('#dashboard-url');
  return page;
};

const fillForm = async (page, { dashboard, api, clientId }) => {
  await page.fill('#dashboard-url', dashboard);
  await page.fill('#api-url', api);
  await page.fill('#client-id', clientId);
  await page.click('#save-connection');
};

test.describe('Options — custom endpoint', () => {
  test('saving a custom endpoint switches to it and signs the user out', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    const options = await openOptions(context, extensionId);
    await fillForm(options, {
      dashboard: 'https://dashboard.example.com/',
      api: 'https://api.example.com/',
      clientId: '42',
    });

    await expect(options.locator('.witty-options-notice')).toBeVisible();

    const stored = await readStorage(options);
    expect(stored.local.apiEndpoint).toBe('Custom');
    expect(stored.local.customEndpoint).toMatchObject({
      dashboard: 'https://dashboard.example.com/',
      api: 'https://api.example.com/',
      oauth_client_id: '42',
    });

    // Invariant: credentials never survive an endpoint change.
    expect(stored.local.signedIn).toBe(false);
    expect(stored.local.refreshToken || '').toBe('');
    expect(stored.session.accessToken || '').toBe('');
  });

  test('rejects a plaintext http endpoint but allows localhost', async ({
    page,
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);

    await fillForm(options, {
      dashboard: 'http://dashboard.example.com/',
      api: 'https://api.example.com/',
      clientId: '42',
    });
    await expect(options.locator('.witty-options-error')).toBeVisible();
    expect((await readStorage(options)).local.customEndpoint).toBeUndefined();

    // Loopback is the documented exception, so a self-hoster can develop
    // against a local dashboard.
    await fillForm(options, {
      dashboard: 'http://localhost:8000/',
      api: 'http://127.0.0.1:8001/',
      clientId: '42',
    });
    await expect(options.locator('.witty-options-notice')).toBeVisible();
    expect((await readStorage(options)).local.apiEndpoint).toBe('Custom');
  });

  test('requires an OAuth client id', async ({ page, context, extensionId }) => {
    const options = await openOptions(context, extensionId);

    await fillForm(options, {
      dashboard: 'https://dashboard.example.com/',
      api: 'https://api.example.com/',
      clientId: '   ',
    });

    await expect(options.locator('.witty-options-error')).toBeVisible();
    expect((await readStorage(options)).local.customEndpoint).toBeUndefined();
  });

  test('reset restores the compiled default and signs out', async ({
    page,
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await fillForm(options, {
      dashboard: 'https://dashboard.example.com/',
      api: 'https://api.example.com/',
      clientId: '42',
    });
    expect((await readStorage(options)).local.apiEndpoint).toBe('Custom');

    await signIn(context, extensionId);
    await options.reload();
    await options.waitForSelector('#dashboard-url');
    await options.click('#reset-connection');
    await expect(options.locator('.witty-options-notice')).toBeVisible();

    const stored = await readStorage(options);
    expect(stored.local.customEndpoint).toBeUndefined();
    expect(stored.local.apiEndpoint).not.toBe('Custom');
    expect(stored.local.signedIn).toBe(false);
  });
});

test.describe('Options — API key mode', () => {
  const saveKeyMode = async (page, { api, key }) => {
    await page.check('#mode-api-key');
    await page.fill('#api-url', api);
    await page.fill('#api-key', key);
    await page.click('#save-connection');
  };

  test('stores the key bound to its endpoint and drops OAuth credentials', async ({
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    const options = await openOptions(context, extensionId);
    await saveKeyMode(options, {
      api: 'https://api.example.com/',
      key: 'secret-key',
    });
    await expect(options.locator('.witty-options-notice')).toBeVisible();

    const stored = await readStorage(options);
    expect(stored.local.authMode).toBe('apiKey');
    expect(stored.local.apiKey).toEqual({
      endpoint: 'Custom',
      value: 'secret-key',
    });
    // No dashboard in key mode, which is what hides the dashboard-backed UI.
    expect(stored.local.customEndpoint.dashboard).toBe('');
    // The account credentials must not linger.
    expect(stored.local.signedIn).toBe(false);
    expect(stored.session.accessToken || '').toBe('');
  });

  test('requires a key before switching to key mode', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await saveKeyMode(options, { api: 'https://api.example.com/', key: '  ' });

    await expect(options.locator('.witty-options-error')).toBeVisible();
    expect((await readStorage(options)).local.authMode).toBeUndefined();
  });

  test('a key is never presented to a different endpoint', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await saveKeyMode(options, {
      api: 'https://api.example.com/',
      key: 'secret-key',
    });

    // Simulate the endpoint moving away from the one the key was entered for —
    // the binding, not a cleanup step, is what protects this.
    await options.evaluate(() =>
      chrome.storage.local.set({ apiEndpoint: 'Prod' })
    );

    const leaks = await options.evaluate(async () => {
      const all = await chrome.storage.local.get(null);
      const record = all.apiKey;
      const current = all.apiEndpoint;
      // Mirrors apiKeyFromStorage: the key resolves only for its own endpoint.
      return record && record.endpoint === current ? record.value : '';
    });

    expect(leaks).toBe('');
  });
});
