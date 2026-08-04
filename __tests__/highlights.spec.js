const {
  test,
  expect,
  signIn,
  signOut,
  setEditorText,
  hasHighlightCanvas,
  typeAndWaitForHighlights,
} = require('./helpers/extension');
const { SAMPLE_TEXT } = require('./helpers/mockApi');

/**
 * Highlight placement, against local fixture pages and a mocked NLP API.
 *
 * Replaces the old highlightPlacment.spec.js, which drove a deployed dashboard's
 * Froala editor. That editor and the HubSpot cookie banner the test dismissed
 * have both since been removed from the dashboard, so those tests could no
 * longer pass regardless of the auth changes.
 */
test.describe('Highlights', () => {
  /**
   * Asserting "no canvas" would be wrong: the extension creates the highlight
   * canvas regardless of sign-in state, so its presence proves nothing. What
   * actually matters — and is a privacy property, not just a UI one — is that a
   * signed-out extension never ships the user's text to the API.
   */
  test('does not send text to the API when signed out', async ({
    page,
    context,
    extensionId,
  }) => {
    const checkRequests = [];
    await context.route(
      (url) => url.pathname.endsWith('/v2.4/check'),
      async (route) => {
        checkRequests.push(route.request().url());
        await route.fallback();
      }
    );

    await signOut(context, extensionId);

    await page.goto('/textarea.html');
    await setEditorText(page, SAMPLE_TEXT);

    // Give the extension the same opportunity it gets when signed in; asserting
    // immediately would pass even if a request were merely slow.
    await page.waitForTimeout(5000);

    expect(checkRequests).toEqual([]);
    await expect(page.locator('#editor')).toHaveScreenshot('textarea-signed-out.png');
  });

  test('sends text to the API when signed in', async ({
    page,
    context,
    extensionId,
  }) => {
    const checkRequests = [];
    await context.route(
      (url) => url.pathname.endsWith('/v2.4/check'),
      async (route) => {
        checkRequests.push(JSON.parse(route.request().postData() || '{}').text);
        await route.fallback();
      }
    );

    await signIn(context, extensionId);

    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    expect(checkRequests).toContain(SAMPLE_TEXT);
  });

  test('renders highlights in a textarea', async ({ page, context, extensionId }) => {
    await signIn(context, extensionId);

    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    // The mock returns three alerts for SAMPLE_TEXT: guys, chairman, mistacke.
    expect(await hasHighlightCanvas(page)).toBe(true);
    await expect(page.locator('#editor')).toHaveScreenshot('textarea-highlights.png');
  });

  test('renders highlights in a contenteditable', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    await page.goto('/contenteditable.html');
    await typeAndWaitForHighlights(page);

    await expect(page.locator('#editor')).toHaveScreenshot(
      'contenteditable-highlights.png'
    );
  });

  test('highlights follow the field content when it scrolls', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    await page.goto('/scrolling.html');
    await typeAndWaitForHighlights(page);

    await page.locator('#editor').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(500);

    await expect(page.locator('#editor')).toHaveScreenshot(
      'scrolling-highlights-scrolled.png'
    );
  });

  test('highlights stay put when the window scrolls', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    await page.goto('/scrolling.html');
    await typeAndWaitForHighlights(page);

    const before = await page.locator('#editor').boundingBox();
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);
    const after = await page.locator('#editor').boundingBox();

    // The field itself moved with the page...
    expect(Math.round(before.y - after.y)).toBeGreaterThan(0);
    // ...and the highlights should still be aligned to it.
    await expect(page.locator('#editor')).toHaveScreenshot(
      'scrolling-highlights-window-scrolled.png'
    );
  });
});
