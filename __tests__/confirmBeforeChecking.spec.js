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
