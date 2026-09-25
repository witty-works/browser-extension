const {
  test,
  expect,
  signIn,
  setEditorText,
  openPopoverForWord,
  paintedAt,
} = require('./helpers/extension');
const { routeCheck, filler } = require('./helpers/checkRoute');

/**
 * Texts longer than the NLP API checks at once (TEXT_MAX_LENGTH, 1000 by
 * default). The API checks only the start of such a request and flags it
 * `limit_reached`; the rest must be sent again, not counted as checked.
 */
test.describe('Long texts', () => {
  for (const fixture of ['textarea', 'contenteditable']) {
    test(`checks the sentences past the API limit too, in a ${fixture}`, async ({
      page,
      context,
      extensionId,
    }) => {
      // A deployment with a lower limit than the build's
      // MAX_CHAR_LENGTH_REQUEST.
      const LIMIT = 300;
      const requests = await routeCheck(context, { limit: LIMIT });

      await signIn(context, extensionId);
      await page.goto(`/${fixture}.html`);
      // Long enough to wrap over several lines, where a textarea's clone
      // once wrapped differently from the textarea itself.
      await setEditorText(page, `${filler(12)} Hey guys, welcome.`);

      // The last sentence reached the API in a request it checked in full...
      await expect
        .poll(
          () =>
            requests.some(
              (text) => text.includes('Hey guys') && text.length <= LIMIT
            ),
          { timeout: 15000 }
        )
        .toBe(true);

      // ...and its highlight is drawn on the word, not beside it. (Clicking
      // alone would not tell: a textarea finds the alert by the caret.)
      await expect
        .poll(() => paintedAt(page, 'guys'), { timeout: 15000 })
        .toBeGreaterThan(0);
      await openPopoverForWord(page, 'guys');
    });
  }

  test('checks sentence by sentence where the API checks less than the smallest batch', async ({
    page,
    context,
    extensionId,
  }) => {
    // Below the extension's smallest batch (100 characters): two short
    // sentences fit one batch, but the API stops before the second's "guys".
    const LIMIT = 60;
    const first = 'We start the meeting at nine in the main hall now.';
    const second = 'Welcome to our team, dear guys.';
    const requests = await routeCheck(context, { limit: LIMIT });

    await signIn(context, extensionId);
    await page.goto('/contenteditable.html');
    await setEditorText(page, `${first} ${second}`);

    await expect
      .poll(() => requests.includes(second), { timeout: 15000 })
      .toBe(true);
    await openPopoverForWord(page, 'guys');
  });
});
