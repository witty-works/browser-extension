const {
  test,
  expect,
  setEditorText,
  waitForHighlights,
} = require('./helpers/extension');

/**
 * Refreshing a refused access token (getNewAccessToken in shared/utils.ts).
 *
 * The content script asks the background worker, which refreshes once for
 * every frame and tab and signs out only when the dashboard rejects the
 * refresh token. The build's own endpoints have no OAuth client in the example
 * config, so these tests sign in against a custom endpoint that has one; the
 * NLP API mocks match on the path and answer for any host.
 */
const DASHBOARD = 'https://dashboard.custom.example/';
const CUSTOM_ENDPOINT = {
  api: 'https://api.custom.example/',
  dashboard: DASHBOARD,
  oauth_client_id: 'fixture-client',
  posthog_url: '',
  posthog_key: '',
};

const seedSignedIn = async (context, extensionId) => {
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${extensionId}/options.html`);
  await setup.evaluate(async (customEndpoint) => {
    await chrome.storage.session?.set({ accessToken: 'fixture-access-token' });
    await chrome.storage.local.set({
      signedIn: true,
      refreshToken: 'fixture-refresh-token',
      accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
      checkEndpointSuccess: true,
      domains: [],
      organizationDomains: { list: [], type: 'deny' },
      spellChecking: true,
      apiDelay: 0,
      apiEndpoint: 'Custom',
      customEndpoint,
    });
  }, CUSTOM_ENDPOINT);
  await setup.close();
};

/** Answer the token endpoint with `respond`, counting the requests. */
const routeTokenEndpoint = async (context, respond) => {
  const requests = [];
  await context.route(`${DASHBOARD}oauth/token`, (route) => {
    requests.push(JSON.parse(route.request().postData() || '{}'));
    return respond(route);
  });
  return requests;
};

/** Refuse check and auth requests sent with any token in `refused`. */
const refuseTokens = async (context, status, refused) => {
  const seen = [];
  await context.route(
    (url) =>
      url.pathname.endsWith('/v2.4/check') ||
      url.pathname.endsWith('/v2.0/auth'),
    async (route) => {
      const authorization = (await route.request().allHeaders()).authorization;
      seen.push(authorization);
      if (refused.some((token) => authorization === `Bearer ${token}`)) {
        return route.fulfill({ status, body: '' });
      }
      return route.fallback();
    }
  );
  return seen;
};

/** The stored tokens, read from an extension page. */
const storedTokens = async (context, extensionId) => {
  const reader = await context.newPage();
  await reader.goto(`chrome-extension://${extensionId}/options.html`);
  const tokens = await reader.evaluate(async () => ({
    access: (await chrome.storage.session.get('accessToken')).accessToken,
    local: await chrome.storage.local.get(['refreshToken', 'signedIn']),
  }));
  await reader.close();
  return tokens;
};

test.describe('Token refresh', () => {
  for (const status of [401, 403]) {
    test(`a ${status} refreshes the token once and retries with the new one`, async ({
      page,
      context,
      extensionId,
    }) => {
      const tokenRequests = await routeTokenEndpoint(context, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'fresh-access-token',
            refresh_token: 'fresh-refresh-token',
            expires_in: 3600,
          }),
        })
      );
      const seen = await refuseTokens(context, status, [
        'fixture-access-token',
      ]);
      await seedSignedIn(context, extensionId);

      await page.goto('/textarea.html');
      await setEditorText(page);
      await waitForHighlights(page);

      expect(tokenRequests).toHaveLength(1);
      expect(tokenRequests[0]).toMatchObject({
        grant_type: 'refresh_token',
        refresh_token: 'fixture-refresh-token',
      });
      expect(seen).toContain('Bearer fresh-access-token');
      expect((await storedTokens(context, extensionId)).access).toBe(
        'fresh-access-token'
      );
    });
  }

  test('a token still refused after the refresh does not start another one', async ({
    page,
    context,
    extensionId,
  }) => {
    let issued = 0;
    const tokenRequests = await routeTokenEndpoint(context, (route) => {
      issued += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: `fresh-access-token-${issued}`,
          refresh_token: `fresh-refresh-token-${issued}`,
          expires_in: 3600,
        }),
      });
    });
    // An account the API does not let in: every token is refused.
    await context.route(
      (url) =>
        url.pathname.endsWith('/v2.4/check') ||
        url.pathname.endsWith('/v2.0/auth'),
      (route) => route.fulfill({ status: 403, body: '' })
    );
    await seedSignedIn(context, extensionId);

    await page.goto('/textarea.html');
    await setEditorText(page);
    await page.waitForTimeout(3000);
    await setEditorText(page, 'Another text for the guys.');
    await page.waitForTimeout(3000);

    expect(tokenRequests).toHaveLength(1);
    expect((await storedTokens(context, extensionId)).local.signedIn).toBe(
      true
    );
  });

  test('a server error from the dashboard keeps the user signed in', async ({
    page,
    context,
    extensionId,
  }) => {
    const tokenRequests = await routeTokenEndpoint(context, (route) =>
      route.fulfill({ status: 503, body: '' })
    );
    await refuseTokens(context, 401, ['fixture-access-token']);
    await seedSignedIn(context, extensionId);

    await page.goto('/textarea.html');
    await setEditorText(page);
    await expect.poll(() => tokenRequests.length).toBeGreaterThan(0);
    await page.waitForTimeout(1000);

    const { access, local } = await storedTokens(context, extensionId);
    expect(access).toBe('fixture-access-token');
    expect(local.refreshToken).toBe('fixture-refresh-token');
    expect(local.signedIn).toBe(true);
  });

  test('a rejected refresh token signs the user out', async ({
    page,
    context,
    extensionId,
  }) => {
    await routeTokenEndpoint(context, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant' }),
      })
    );
    await refuseTokens(context, 401, ['fixture-access-token']);
    await seedSignedIn(context, extensionId);

    await page.goto('/textarea.html');
    await setEditorText(page);

    await expect
      .poll(
        async () => (await storedTokens(context, extensionId)).local.signedIn
      )
      .toBe(false);
    expect(
      (await storedTokens(context, extensionId)).local.refreshToken || ''
    ).toBe('');
  });
});
