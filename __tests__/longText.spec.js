const {
  test,
  expect,
  signIn,
  setEditorText,
  openPopoverForWord,
} = require('./helpers/extension');
const {
  ALERTS,
  buildCheckResult,
  checkResponse,
} = require('./helpers/mockApi');

/**
 * Texts longer than the NLP API checks at once (TEXT_MAX_LENGTH, 1000 by
 * default). The API checks only the start of such a request and flags it
 * `limit_reached`; the rest must be sent again, not counted as checked.
 */
test.describe('Long texts', () => {
  test('checks the sentences past the API limit too', async ({
    page,
    context,
    extensionId,
  }) => {
    // A deployment with a lower limit than the build's MAX_CHAR_LENGTH_REQUEST,
    // flagging "guys" only where it looked.
    const LIMIT = 300;
    const requests = [];
    const [guys] = ALERTS;
    await context.route(
      (url) => url.pathname.endsWith('/v2.4/check'),
      (route) => {
        const text = JSON.parse(route.request().postData() || '{}').text || '';
        requests.push(text);
        const results = [...text.slice(0, LIMIT).matchAll(/\bguys\b/g)].map(
          (match, index) =>
            buildCheckResult(
              { ...guys, start: match.index, end: match.index + 4 },
              index
            )
        );
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...checkResponse(''),
            results,
            limit_reached: text.length > LIMIT,
          }),
        });
      }
    );

    await signIn(context, extensionId);
    // A contenteditable: in a textarea, wrapped lines can place the highlight
    // off the word (a separate issue), which the click below depends on.
    await page.goto('/contenteditable.html');

    const filler = Array.from(
      { length: 12 },
      (_, index) => `Sentence number ${index} is filler without any issue.`
    ).join(' ');
    await setEditorText(page, `${filler} Hey guys, welcome.`);

    // The last sentence reached the API in a request it checked in full...
    await expect
      .poll(() => requests.some((text) => text.includes('Hey guys')), {
        timeout: 15000,
      })
      .toBe(true);
    await expect
      .poll(
        () =>
          requests.some(
            (text) => text.includes('Hey guys') && text.length <= LIMIT
          ),
        { timeout: 15000 }
      )
      .toBe(true);

    // ...and its alert is there to open.
    await openPopoverForWord(page, 'guys');
  });
});
