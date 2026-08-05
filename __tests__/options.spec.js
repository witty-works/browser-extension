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

const { CATEGORIES } = require('./helpers/mockApi');

test.describe('Options — category levels', () => {
  const level = (page, key) =>
    page.locator(`[data-category="${key}"]`).getAttribute('data-level');

  const disabled = (page) =>
    page.evaluate(async () =>
      (await chrome.storage.local.get('disabledCategories')).disabledCategories || []
    );

  test('renders categories grouped, from the API', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#categories-section');

    for (const group of CATEGORIES.groups) {
      await expect(
        options.locator('#categories-section h3', { hasText: group.label })
      ).toBeVisible();
    }
    for (const c of CATEGORIES.categories) {
      await expect(options.locator(`[data-category="${c.key}"]`)).toBeVisible();
    }
  });

  test('cycles off, basic and advanced and maps them to disabled_categories', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#categories-section');

    const toggle = options.locator('[data-category="gendered_nouns"]');

    // Starts fully enabled: nothing about it is in the disabled list.
    expect(await level(options, 'gendered_nouns')).toBe('2');

    // advanced -> off
    await toggle.click();
    expect(await level(options, 'gendered_nouns')).toBe('0');
    expect(await disabled(options)).toContain('gendered_nouns');

    // off -> basic: the base key is enabled again, only the advanced variant off
    await toggle.click();
    expect(await level(options, 'gendered_nouns')).toBe('1');
    let list = await disabled(options);
    expect(list).toContain('gendered_nouns_advanced');
    expect(list).not.toContain('gendered_nouns');

    // basic -> advanced: neither key disabled
    await toggle.click();
    expect(await level(options, 'gendered_nouns')).toBe('2');
    list = await disabled(options);
    expect(list).not.toContain('gendered_nouns');
    expect(list).not.toContain('gendered_nouns_advanced');
  });

  test('a category without an advanced variant skips that level', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#categories-section');

    const toggle = options.locator('[data-category="plain_language"]');
    expect(await level(options, 'plain_language')).toBe('1');

    await toggle.click();
    expect(await level(options, 'plain_language')).toBe('0');

    // Back to basic, never to advanced — the API would ignore that level.
    await toggle.click();
    expect(await level(options, 'plain_language')).toBe('1');
    expect(await disabled(options)).not.toContain('plain_language_advanced');
  });

  test('slurs and hate speech cannot be switched off', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#categories-section');

    const toggle = options.locator('[data-category="slurs"]');
    const before = await level(options, 'slurs');

    // Marked aria-disabled, which Playwright honours by refusing a normal click.
    await expect(toggle).toHaveAttribute('aria-disabled', 'true');

    // Force past that to prove the handler itself refuses too, rather than the
    // control merely looking unclickable.
    await toggle.click({ force: true });
    await options.waitForTimeout(200);

    expect(await level(options, 'slurs')).toBe(before);
    expect(await disabled(options)).not.toContain('slurs');
  });
});

const { CONFIG_OPTIONS } = require('./helpers/mockApi');

test.describe('Options — gender forms', () => {
  const stored = (page) =>
    page.evaluate(async () =>
      (await chrome.storage.local.get('languageFormat')).languageFormat || {}
    );

  test('offers every value the API reports, defaulting to the server', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#language-format-section');

    for (const [field, option] of Object.entries(CONFIG_OPTIONS.options)) {
      const select = options.locator(`[data-field="${field}"]`);
      await expect(select).toBeVisible();
      // Every API value, plus the leading "server default" entry.
      await expect(select.locator('option')).toHaveCount(
        option.values.length + 1
      );
      // Nothing chosen yet, so the API default applies.
      await expect(select).toHaveValue('');
    }

    expect(await stored(options)).toEqual({});
  });

  test('labels the Inklusivum rather than showing the raw enum value', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#language-format-section');

    const label = await options
      .locator('[data-field="gendered_roles_format"] option[value="inclusive_gender"]')
      .textContent();

    expect(label.trim()).toBe('Suggest the chosen gender separator');
  });

  test('stores a choice and clears it again', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#language-format-section');

    await options.selectOption('[data-field="german_gender_ending"]', ':in');
    await options.selectOption(
      '[data-field="gendered_roles_format"]',
      'inclusive_gender'
    );
    expect(await stored(options)).toEqual({
      german_gender_ending: ':in',
      gendered_roles_format: 'inclusive_gender',
    });

    // Back to the server default: the field is removed, not stored blank, so
    // the API applies its own default rather than receiving ''.
    await options.selectOption('[data-field="german_gender_ending"]', '');
    expect(await stored(options)).toEqual({
      gendered_roles_format: 'inclusive_gender',
    });
  });
});

test.describe('Options — gender form labels', () => {
  test('uses the labels the API supplies', async ({ context, extensionId }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#language-format-section');

    const label = await options
      .locator('[data-field="german_gender_ending"] option[value="*in"]')
      .textContent();

    expect(label.trim()).toBe(CONFIG_OPTIONS.options.german_gender_ending.labels['*in']);
  });

  test('falls back to the raw value where the API has no label', async ({
    context,
    extensionId,
  }) => {
    const options = await openOptions(context, extensionId);
    await options.waitForSelector('#language-format-section');

    // `(-)` has no dashboard wording, so the value itself is shown.
    const label = await options
      .locator('[data-field="german_gender_ending"] option[value="(-)"]')
      .textContent();

    expect(label.trim()).toBe('(-)');
  });
});
