const { test, expect, signIn, signOut } = require('./helpers/extension');

/**
 * Popup states, with no dashboard involved.
 *
 * The previous popup.test.js was commented out in its entirety — every test
 * needed a dashboard login with a shared "premium" account, and the popup it
 * asserted against had an upgrade state that no longer exists.
 */
test.describe('Popup', () => {
  test('shows the sign-in state when signed out', async ({
    page,
    context,
    extensionId,
  }) => {
    await signOut(context, extensionId);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // The sign-in button is the popup's primary action when unauthenticated.
    await expect(page.locator('.witty-works-ext-primary-button-red')).toBeVisible();
  });

  test('shows the main popup when signed in', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('.witty-works-ext-toggle-encloser').first()).toBeVisible();
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
