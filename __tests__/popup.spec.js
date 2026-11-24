const {
  test,
  expect,
  signIn,
  signOut,
  setEditorText,
} = require('./helpers/extension');
const { BASE_URLS } = require('../source/witty.config.json');

/**
 * Popup states, with no dashboard involved.
 *
 * The previous popup.test.js was commented out in its entirety — every test
 * needed a dashboard login with a shared "premium" account, and the popup it
 * asserted against had an upgrade state that no longer exists.
 */
test.describe('Popup', () => {
  /** The /v2.0/auth requests the popup makes, and storage's endpoint flag. */
  const openPopupWithEndpoint = async (page, context, extensionId, key) => {
    await signIn(context, extensionId);
    const setup = await context.newPage();
    await setup.goto(`chrome-extension://${extensionId}/popup.html`);
    await setup.evaluate(
      (endpoint) => chrome.storage.local.set({ apiEndpoint: endpoint }),
      key
    );
    await setup.close();

    // From any page or the service worker, which makes the API requests.
    const authRequests = [];
    context.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/v2.0/auth')) {
        authRequests.push(request.url());
      }
    });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    return authRequests;
  };

  const checkEndpointSuccess = (page) =>
    page.evaluate(async () => {
      const stored = await chrome.storage.local.get('checkEndpointSuccess');
      return stored.checkEndpointSuccess;
    });

  test('sends no credentials when the stored endpoint is not configured', async ({
    page,
    context,
    extensionId,
  }) => {
    // A key from an earlier build, or a custom endpoint that is gone: the
    // stored token belongs to that endpoint, not to the build default.
    const authRequests = await openPopupWithEndpoint(
      page,
      context,
      extensionId,
      'GoneEndpoint'
    );

    await expect.poll(() => checkEndpointSuccess(page)).toBe(false);
    expect(authRequests).toEqual([]);
  });

  test('authenticates against a configured stored endpoint', async ({
    page,
    context,
    extensionId,
  }) => {
    const authRequests = await openPopupWithEndpoint(
      page,
      context,
      extensionId,
      'Prod'
    );

    await expect.poll(() => authRequests.length).toBeGreaterThan(0);
    // To the endpoint the stored key names, as built into this extension.
    expect(authRequests[0].startsWith(BASE_URLS.Prod.api)).toBe(true);
  });

  test('shows the sign-in state when signed out', async ({
    page,
    context,
    extensionId,
  }) => {
    await signOut(context, extensionId);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // The sign-in button is the popup's primary action when unauthenticated.
    await expect(
      page.locator('.witty-works-ext-primary-button-red')
    ).toBeVisible();
  });

  test('shows the main popup when signed in', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(
      page.locator('.witty-works-ext-toggle-encloser').first()
    ).toBeVisible();
  });

  test('sign-in button asks the background worker to run the OAuth flow', async ({
    page,
    context,
    extensionId,
  }) => {
    await signOut(context, extensionId);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Assert on the message rather than the flow itself: launchWebAuthFlow
    // needs a real authorization server, which is exactly what this suite does
    // without. Stubbing sendMessage proves the popup delegates correctly, and
    // the background handler is covered separately.
    await page.evaluate(() => {
      window.__sentMessages = [];
      const original = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = (message) => {
        window.__sentMessages.push(message);
        return Promise.resolve({ status: 'cancelled' });
      };
      window.__restoreSendMessage = () => {
        chrome.runtime.sendMessage = original;
      };
    });

    await page.locator('.witty-works-ext-primary-button-red').click();

    const messages = await page.evaluate(() => window.__sentMessages);
    expect(messages).toEqual([{ type: 'witty:sign-in', register: false }]);
  });

  test('sign-up link requests the registration variant', async ({
    page,
    context,
    extensionId,
  }) => {
    await signOut(context, extensionId);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.evaluate(() => {
      window.__sentMessages = [];
      chrome.runtime.sendMessage = (message) => {
        window.__sentMessages.push(message);
        return Promise.resolve({ status: 'cancelled' });
      };
    });

    await page.locator('#witty-sign-up').click();

    const messages = await page.evaluate(() => window.__sentMessages);
    expect(messages).toEqual([{ type: 'witty:sign-in', register: true }]);
  });
});

/**
 * A stored endpoint key that names no configured endpoint: one left by another
 * build, or 'Custom' after the custom endpoint lost its API URL. The token or
 * API key stored with it was issued for that endpoint, so it must not reach
 * the build default the key would otherwise fall back to (storedEndpoint.ts).
 */
test.describe('Stored endpoint that is not configured', () => {
  // The default of this (production, TESTING) build; see DefaultBaseUrlKey.
  const DEFAULT_KEY = 'Prod';
  const CUSTOM_API = 'https://api.custom.example/';

  /** Every request, from any page or the service worker, with a credential. */
  const recordCredentialedRequests = (context) => {
    const seen = [];
    const pending = [];
    const inspect = (request) => {
      pending.push(
        request
          .allHeaders()
          .then((headers) => {
            const credential = headers.authorization
              ? 'authorization'
              : headers['x-key']
                ? 'x-key'
                : '';
            if (credential) seen.push({ url: request.url(), credential });
          })
          .catch(() => {})
      );
    };
    context.on('request', inspect);
    return async () => {
      await Promise.all(pending);
      return seen;
    };
  };

  /**
   * Sign in (as `signIn` does) with `items` stored alongside, in one write.
   * Done from the options page, whose only requests carry no credential, so
   * every credentialed request recorded afterwards follows from this state.
   */
  const seedSignedIn = async (context, extensionId, items) => {
    const setup = await context.newPage();
    await setup.goto(`chrome-extension://${extensionId}/options.html`);
    await setup.evaluate(async (values) => {
      await chrome.storage.session?.set({
        accessToken: 'fixture-access-token',
      });
      await chrome.storage.local.set({
        signedIn: true,
        refreshToken: 'fixture-refresh-token',
        accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
        checkEndpointSuccess: true,
        domains: [],
        organizationDomains: { list: [], type: 'deny' },
        spellChecking: true,
        apiDelay: 0,
        ...values,
      });
    }, items);
    await setup.close();
  };

  const readStorage = (page) =>
    page.evaluate(async () => ({
      local: await chrome.storage.local.get(null),
      session: (await chrome.storage.session?.get(null)) || {},
    }));

  /** Type into a fixture page and give the content script time to check it. */
  const typeOnPage = async (context) => {
    const page = await context.newPage();
    await page.goto('/textarea.html');
    await setEditorText(page);
    // Longer than the check debounce (apiDelay is 0 after signIn) and the
    // round trip to the mocked API; a credentialed check would be sent by then.
    await page.waitForTimeout(3000);
    await page.close();
  };

  test('an account token is cleared, not sent to the default endpoint', async ({
    page,
    context,
    extensionId,
  }) => {
    const credentialed = recordCredentialedRequests(context);
    await seedSignedIn(context, extensionId, { apiEndpoint: 'GoneEndpoint' });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await typeOnPage(context);
    expect(await credentialed()).toEqual([]);

    await expect
      .poll(async () => (await readStorage(page)).local.apiEndpoint)
      .toBe(DEFAULT_KEY);
    const { local, session } = await readStorage(page);
    expect(session.accessToken || '').toBe('');
    expect(local.accessToken || '').toBe('');
    expect(local.refreshToken || '').toBe('');
    expect(local.signedIn).toBe(false);
    expect(local.checkEndpointSuccess).toBe(false);
  });

  test('an API key for a custom endpoint that lost its API URL is cleared, not sent', async ({
    page,
    context,
    extensionId,
  }) => {
    const credentialed = recordCredentialedRequests(context);
    await seedSignedIn(context, extensionId, {
      apiEndpoint: 'Custom',
      customEndpoint: { api: '', dashboard: '', oauth_client_id: '' },
      authMode: 'apiKey',
      apiKey: { endpoint: 'Custom', value: 'stale-api-key' },
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await typeOnPage(context);
    expect(await credentialed()).toEqual([]);

    await expect
      .poll(async () => (await readStorage(page)).local.apiEndpoint)
      .toBe(DEFAULT_KEY);
    const { local, session } = await readStorage(page);
    expect(local.apiKey?.value || '').toBe('');
    expect(local.authMode).not.toBe('apiKey');
    expect(session.accessToken || '').toBe('');
    expect(local.signedIn).toBe(false);
  });

  test('a token for the stored default endpoint is still sent to it', async ({
    page,
    context,
    extensionId,
  }) => {
    const credentialed = recordCredentialedRequests(context);
    await seedSignedIn(context, extensionId, { apiEndpoint: DEFAULT_KEY });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await typeOnPage(context);

    const sent = await credentialed();
    expect(sent.length).toBeGreaterThan(0);
    for (const request of sent) {
      expect(request.url.startsWith(BASE_URLS[DEFAULT_KEY].api)).toBe(true);
      expect(request.credential).toBe('authorization');
    }
    expect((await readStorage(page)).local.apiEndpoint).toBe(DEFAULT_KEY);
  });

  test('an API key for a registered custom endpoint is still sent to it', async ({
    page,
    context,
    extensionId,
  }) => {
    const credentialed = recordCredentialedRequests(context);
    await seedSignedIn(context, extensionId, {
      apiEndpoint: 'Custom',
      customEndpoint: {
        api: CUSTOM_API,
        dashboard: '',
        oauth_client_id: '',
        posthog_url: '',
        posthog_key: '',
      },
      authMode: 'apiKey',
      apiKey: { endpoint: 'Custom', value: 'custom-api-key' },
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await typeOnPage(context);

    const sent = await credentialed();
    expect(sent.length).toBeGreaterThan(0);
    for (const request of sent) {
      expect(request.url.startsWith(CUSTOM_API)).toBe(true);
      expect(request.credential).toBe('x-key');
    }
    const { local } = await readStorage(page);
    expect(local.apiEndpoint).toBe('Custom');
    expect(local.apiKey.value).toBe('custom-api-key');
  });
});

test.describe('Popup — options link', () => {
  // The options page is where a self-hosted server or an API key is configured.
  // It must be reachable *before* sign-in, or a self-hoster cannot get started:
  // until this link existed the page was only reachable via chrome://extensions.
  for (const [state, prepare] of [
    ['signed out', signOut],
    ['signed in', signIn],
  ]) {
    test(`is present when ${state}`, async ({ page, context, extensionId }) => {
      await prepare(context, extensionId);
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      await expect(page.locator('#witty-options-link')).toBeVisible();
    });
  }
});

test.describe('Popup — translations', () => {
  /**
   * Every other assertion here selects by class or id, so i18next could fail
   * to resolve anything and the popup would still "render" — just with raw
   * keys in place of copy. That is the failure mode an i18next major upgrade
   * introduces, and nothing else in this suite would notice it.
   *
   * Chromium runs as en-US, and the detector is configured to read the
   * navigator language, so English is the expected resolution.
   */
  test('renders translated copy, not raw keys or placeholders', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('#witty-options-link')).toHaveText(
      'Extension settings'
    );

    const text = await page.locator('body').innerText();

    // A missed lookup renders the key itself...
    for (const key of [
      'extensionSettings',
      'enableWitty',
      'helpCentre',
      'websiteSettings',
      'spellChecking',
    ]) {
      expect(text, `popup shows the raw key "${key}"`).not.toContain(key);
    }

    // ...and a failed interpolation leaves the placeholder behind.
    expect(text, 'popup shows an uninterpolated placeholder').not.toContain(
      '{{'
    );
  });
});

test.describe('Popup — sign out', () => {
  const REVOKE_PATH = '/api/user/revoke-token';

  const readTokens = (page) =>
    page.evaluate(async () => ({
      session: (await chrome.storage.session?.get('accessToken')) || {},
      local: await chrome.storage.local.get(['refreshToken', 'signedIn']),
    }));

  test('the sign-out button asks the background worker to sign out', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.evaluate(() => {
      window.__sentMessages = [];
      chrome.runtime.sendMessage = (message) => {
        window.__sentMessages.push(message);
        return Promise.resolve({ status: 'success' });
      };
    });

    await page.locator('#witty-sign-out').click();

    // The popup also asks the background for its API requests.
    const messages = await page.evaluate(() =>
      window.__sentMessages.filter(
        (message) => message.type !== 'witty:api-request'
      )
    );
    expect(messages).toEqual([{ type: 'witty:sign-out' }]);
  });

  test('signing out revokes the token on the dashboard and clears it', async ({
    page,
    context,
    extensionId,
  }) => {
    const revocations = [];
    await context.route(
      (url) => url.pathname.endsWith(REVOKE_PATH),
      (route) => {
        revocations.push({
          method: route.request().method(),
          authorization: route.request().headers().authorization,
        });
        return route.fulfill({ status: 204, body: '' });
      }
    );

    await signIn(context, extensionId);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.locator('#witty-sign-out').click();

    await expect.poll(() => revocations.length).toBe(1);
    expect(revocations[0]).toEqual({
      method: 'POST',
      authorization: 'Bearer fixture-access-token',
    });
    await expect
      .poll(async () => (await readTokens(page)).local.signedIn)
      .toBe(false);
    const { session, local } = await readTokens(page);
    expect(session.accessToken || '').toBe('');
    expect(local.refreshToken || '').toBe('');
  });

  test('signing out clears the tokens when the dashboard cannot revoke them', async ({
    page,
    context,
    extensionId,
  }) => {
    // An older dashboard without the route.
    await context.route(
      (url) => url.pathname.endsWith(REVOKE_PATH),
      (route) => route.fulfill({ status: 404, body: '' })
    );

    await signIn(context, extensionId);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const reply = await page.evaluate(() =>
      chrome.runtime.sendMessage({ type: 'witty:sign-out' })
    );
    expect(reply).toEqual({ status: 'success' });

    const { session, local } = await readTokens(page);
    expect(session.accessToken || '').toBe('');
    expect(local.refreshToken || '').toBe('');
  });
});
