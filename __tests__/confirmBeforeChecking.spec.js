const {
  test,
  expect,
  signIn,
  setEditorText,
  waitForHighlights,
} = require('./helpers/extension');
const { authResponse } = require('./helpers/mockApi');

/**
 * "Ask before checking a field" (shared/confirmBeforeChecking.ts,
 * ContentScript/ConfirmCheckPrompt.tsx): with it on, no text from a field
 * reaches the API until the user confirms that field.
 */

/** Answer /v2.0/auth with the organisation's confirm_before_checking. */
const routeAuth = (context, confirmBeforeChecking) =>
  context.route(
    (url) => url.pathname.endsWith('/v2.0/auth'),
    (route) => {
      const response = authResponse();
      response.organization_config.confirm_before_checking =
        confirmBeforeChecking;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }
  );

/** As routeAuth, but the answer arrives only after `delay` ms. */
const routeAuthLate = (context, confirmBeforeChecking, delay) =>
  context.route(
    (url) => url.pathname.endsWith('/v2.0/auth'),
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const response = authResponse();
      response.organization_config.confirm_before_checking =
        confirmBeforeChecking;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }
  );

/** The texts sent to /v2.4/check, from any page or the service worker. */
const recordChecks = (context) => {
  const texts = [];
  context.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/v2.4/check')) {
      try {
        texts.push(JSON.parse(request.postData() || '{}').text || '');
      } catch (error) {
        texts.push('');
      }
    }
  });
  return texts;
};

/** The prompt's confirm button, inside the (test-build open) shadow root. */
const findInShadow = (page, id) =>
  page.evaluate((wanted) => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.id === wanted) {
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
        const hit = el.shadowRoot && walk(el.shadowRoot);
        if (hit) return hit;
      }
      return null;
    };
    return walk(document);
  }, id);

/** Sign in with the organisation's setting stored, as /v2.0/auth leaves it. */
const signInWith = async (context, extensionId, organization) => {
  await signIn(context, extensionId);
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${extensionId}/options.html`);
  await setup.evaluate(
    (value) => chrome.storage.local.set({ confirmBeforeCheckingOrg: value }),
    organization
  );
  await setup.close();
};

test.describe('Ask before checking a field', () => {
  const FORCED_ON = { value: true, status: 'force' };

  test('a forced setting holds from the first check after sign-in', async ({
    page,
    context,
    extensionId,
  }) => {
    // The organisation's answer comes with /v2.0/auth; until it has arrived,
    // nothing from the field may be sent.
    await routeAuthLate(context, FORCED_ON, 2500);
    const checks = recordChecks(context);
    await signIn(context, extensionId);

    await page.goto('/textarea.html');
    await setEditorText(page);
    await page.waitForTimeout(1500);
    expect(checks.filter(Boolean)).toEqual([]);

    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'), { timeout: 10000 })
      .not.toBeNull();
    expect(checks.filter(Boolean)).toEqual([]);
  });

  test('checks again after signing out and back in within the same tab', async ({
    page,
    context,
    extensionId,
  }) => {
    // Signing out resets the marker but not the config hashes, and the
    // same account's answer carries the same hashes.
    await routeAuth(context, null);
    const checks = recordChecks(context);
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await setEditorText(page);
    await expect
      .poll(() => checks.filter(Boolean).length, { timeout: 10000 })
      .toBeGreaterThan(0);

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    // What logOut() leaves behind.
    await options.evaluate(async () => {
      await chrome.storage.session.set({ accessToken: '' });
      await chrome.storage.local.set({
        signedIn: false,
        refreshToken: '',
        checkEndpointSuccess: false,
        confirmBeforeCheckingOrg: null,
        confirmBeforeCheckingKnown: false,
      });
    });
    await page.waitForTimeout(500);
    const before = checks.length;
    // What a sign-in writes.
    await options.evaluate(async () => {
      await chrome.storage.session.set({ accessToken: 'fixture-access-token' });
      await chrome.storage.local.set({
        signedIn: true,
        refreshToken: 'fixture-refresh-token',
        accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
      });
    });
    await options.close();
    await page.waitForTimeout(1000);

    // Sentences checked before are answered from the cache; a new one is
    // sent. Typed, as the field listens to key events.
    await page.locator('#editor').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' The chairman thanked the policemen.');
    await expect
      .poll(() => checks.slice(before).filter(Boolean).length, {
        timeout: 10000,
      })
      .toBeGreaterThan(0);
  });

  test('checks once /v2.0/auth answers after an outage', async ({
    page,
    context,
    extensionId,
  }) => {
    // Down until every context has made its one request on load.
    let down = true;
    await context.route(
      (url) => url.pathname.endsWith('/v2.0/auth'),
      (route) => {
        if (down) return route.fulfill({ status: 503, body: '' });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(authResponse()),
        });
      }
    );
    const checks = recordChecks(context);
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await setEditorText(page);
    await page.waitForTimeout(1500);
    expect(checks.filter(Boolean)).toEqual([]);
    down = false;
    await expect
      .poll(() => checks.filter(Boolean).length, { timeout: 15000 })
      .toBeGreaterThan(0);
  });

  test('sends nothing before the user confirms, and checks after', async ({
    page,
    context,
    extensionId,
  }) => {
    await routeAuth(context, FORCED_ON);
    const checks = recordChecks(context);
    await signInWith(context, extensionId, FORCED_ON);

    await page.goto('/textarea.html');
    await setEditorText(page);
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .not.toBeNull();
    await page.waitForTimeout(2000);
    expect(checks.filter(Boolean)).toEqual([]);

    // A page script's click does not confirm.
    await page.evaluate(() => {
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.id === 'witty-confirm-check') return el;
          const hit = el.shadowRoot && walk(el.shadowRoot);
          if (hit) return hit;
        }
        return null;
      };
      walk(document).click();
    });
    await page.waitForTimeout(1500);
    expect(checks.filter(Boolean)).toEqual([]);

    // The user's own click does.
    const button = await findInShadow(page, 'witty-confirm-check');
    await page.mouse.click(button.x, button.y);
    await waitForHighlights(page);
    expect(checks.filter(Boolean).length).toBeGreaterThan(0);
    expect(await findInShadow(page, 'witty-confirm-check')).toBeNull();
  });

  test('confirms with the keyboard, and Escape closes the question', async ({
    page,
    context,
    extensionId,
  }) => {
    await routeAuth(context, FORCED_ON);
    const checks = recordChecks(context);
    await signInWith(context, extensionId, FORCED_ON);

    await page.goto('/textarea.html');
    await setEditorText(page);
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .not.toBeNull();

    // The prompt comes before the field in the tab order.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Escape');
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .toBeNull();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(
      'editor'
    );
    expect(checks.filter(Boolean)).toEqual([]);

    // Focusing the field again asks again; Enter on the button confirms.
    await page.locator('#editor').blur();
    await page.locator('#editor').focus();
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .not.toBeNull();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await waitForHighlights(page);
    expect(checks.filter(Boolean).length).toBeGreaterThan(0);
  });

  test('the question appears in a live region that was there empty first', async ({
    page,
    context,
    extensionId,
  }) => {
    // Screen readers announce a change to a live region they already know,
    // not one inserted with its text: the empty <output> comes first.
    await routeAuth(context, FORCED_ON);
    await signInWith(context, extensionId, FORCED_ON);
    await page.goto('/textarea.html');
    // From here, note the first state of the prompt's <output> seen.
    await page.evaluate(() => {
      window.__firstOutputText = undefined;
      const find = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === 'OUTPUT' && el.closest('fieldset')) return el;
          const hit = el.shadowRoot && find(el.shadowRoot);
          if (hit) return hit;
        }
        return null;
      };
      const poll = () => {
        const output = find(document);
        if (output) {
          window.__firstOutputText = output.textContent;
          return;
        }
        setTimeout(poll, 5);
      };
      poll();
    });
    await setEditorText(page);
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .not.toBeNull();
    expect(await page.evaluate(() => window.__firstOutputText)).toBe('');
  });

  test('the question closes when focus leaves the field', async ({
    page,
    context,
    extensionId,
  }) => {
    await routeAuth(context, FORCED_ON);
    await signInWith(context, extensionId, FORCED_ON);
    await page.goto('/textarea.html');
    await setEditorText(page);
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .not.toBeNull();

    // Forward, out of the field and away from the question before it.
    await page.locator('#editor').evaluate((field) => field.blur());
    await expect
      .poll(() => findInShadow(page, 'witty-confirm-check'))
      .toBeNull();
  });

  test('is off by default: the text is checked without asking', async ({
    page,
    context,
    extensionId,
  }) => {
    const checks = recordChecks(context);
    await signIn(context, extensionId);

    await page.goto('/textarea.html');
    await setEditorText(page);
    await waitForHighlights(page);

    expect(checks.filter(Boolean).length).toBeGreaterThan(0);
    expect(await findInShadow(page, 'witty-confirm-check')).toBeNull();
  });

  test('the options page locks the setting the organisation forces', async ({
    page,
    context,
    extensionId,
  }) => {
    await signInWith(context, extensionId, FORCED_ON);
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const toggle = page.locator('#opt-confirm-before-checking');
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeDisabled();
    await expect(
      page.locator('#opt-confirm-before-checking-hint')
    ).toContainText('locked by your team admin');
  });

  test('the user can turn on what the organisation only suggests', async ({
    page,
    context,
    extensionId,
  }) => {
    await signInWith(context, extensionId, {
      value: false,
      status: 'suggestion',
    });
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const toggle = page.locator('#opt-confirm-before-checking');
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toBeEnabled();
    await toggle.check();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await chrome.storage.local.get('confirmBeforeChecking'))
              .confirmBeforeChecking
        )
      )
      .toBe(true);
  });
});
