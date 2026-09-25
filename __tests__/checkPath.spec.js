const {
  test,
  expect,
  signIn,
  setEditorText,
  openPopoverForWord,
  paintedAt,
} = require('./helpers/extension');
const { routeCheck, filler, editText } = require('./helpers/checkRoute');

/**
 * How the extension pairs check answers with the text they are about, when
 * requests overlap or fail.
 */
test.describe('Check requests', () => {
  test('ignores the answer to a request a newer one replaced', async ({
    page,
    context,
    extensionId,
  }) => {
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const requests = await routeCheck(context, {
      // The first request, about "guys", answers only after the second.
      answer: (text, index) => (index === 0 ? held : undefined),
    });

    await signIn(context, extensionId);
    await page.goto('/contenteditable.html');
    await setEditorText(page, 'Hey guys, welcome to the meeting.');
    await expect.poll(() => requests.length, { timeout: 15000 }).toBe(1);

    // The text changes, and its own "guys" is found at once.
    await editText(page, 'Hello there, dear guys, nice to see you.');
    await expect.poll(() => requests.length, { timeout: 15000 }).toBe(2);
    await expect
      .poll(() => paintedAt(page, 'guys'), { timeout: 15000 })
      .toBeGreaterThan(0);

    // Now the stale answer about the first text arrives. Taken for the new
    // text's, it would replace that text's alerts with its own "guys" at
    // 4-8, which lies on "o th".
    release();
    await page.waitForTimeout(1500);
    expect(await paintedAt(page, 'guys')).toBeGreaterThan(0);
    await openPopoverForWord(page, 'guys');
  });

  test('asks again for a batch that failed, with the next edit', async ({
    page,
    context,
    extensionId,
  }) => {
    let failed = false;
    const requests = await routeCheck(context, {
      // The first batch fails once; everything after it answers.
      answer: (text) => {
        if (failed || !text.includes('Hey guys')) return undefined;
        failed = true;
        return { status: 500 };
      },
    });

    await signIn(context, extensionId);
    await page.goto('/contenteditable.html');
    // Longer than one request (MAX_CHAR_LENGTH_REQUEST, 1000): "guys" is in
    // the first batch, the last sentence in the next one.
    const text = `Hey guys, welcome. ${filler(24)}`;
    await setEditorText(page, `${text} The end is here.`);
    await expect.poll(() => failed, { timeout: 15000 }).toBe(true);

    // An edit after the first batch: that batch, unchanged, is sent again.
    await editText(page, `${text} The end is near.`);

    await expect
      .poll(() => requests.filter((sent) => sent.includes('Hey guys')).length, {
        timeout: 15000,
      })
      .toBe(2);
    await openPopoverForWord(page, 'guys');
    expect(await paintedAt(page, 'guys')).toBeGreaterThan(0);
  });

  test('counts a check as done only after its last batch', async ({
    page,
    context,
    extensionId,
  }) => {
    const LIMIT = 300;
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const requests = await routeCheck(context, {
      limit: LIMIT,
      // The first answer is cut short, and the retry waits.
      answer: (text, index) =>
        index === 0 ? { fields: { notifications: 7 } } : held,
    });
    const storedNotifications = async () => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      const { numberOfNotifications } = await popup.evaluate(() =>
        chrome.storage.local.get('numberOfNotifications')
      );
      await popup.close();
      return numberOfNotifications;
    };

    await signIn(context, extensionId);
    await page.goto('/contenteditable.html');
    await setEditorText(page, `${filler(12)} Hey guys, welcome.`);
    await expect.poll(() => requests.length, { timeout: 15000 }).toBe(2);

    // The first answer was not the check's last: its count is not stored.
    await page.waitForTimeout(1000);
    expect(await storedNotifications()).toBeUndefined();

    release();
    await expect.poll(storedNotifications, { timeout: 15000 }).toBe(0);
  });
});
