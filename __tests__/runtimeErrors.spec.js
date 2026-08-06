const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
  openPopoverForWord,
} = require('./helpers/extension');

/**
 * Guards the React runtime itself.
 *
 * Every other spec asserts on what rendered — geometry, screenshots, stored
 * values. None of them notice a component that throws, warns about invalid
 * hook order, or renders nothing where nothing was expected anyway. React
 * major upgrades break exactly there, so these tests drive the normal flows
 * and assert the console stayed quiet.
 *
 * `pageerror` (an uncaught exception) is always a defect. Console errors are
 * filtered down to React's own complaints, because fixtures deliberately
 * trigger network failures — see blockExternalRequests — and those log errors
 * that say nothing about the extension.
 */

/** Anything React logs about hooks, element types or invalid props. */
const REACT_COMPLAINT =
  /Warning:|hook|Hook|not wrapped in act|Each child in a list|Invalid|invalid prop|is not a function|Cannot read propert|undefined is not|Minified React error/;

/** Failures caused by the fixtures blocking the network, not by the code. */
const NETWORK_NOISE =
  /net::|Failed to load resource|ERR_FAILED|ERR_BLOCKED|favicon/i;

const watchForRuntimeErrors = (page) => {
  const found = [];

  page.on('pageerror', (error) => {
    found.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const text = message.text();
    if (NETWORK_NOISE.test(text)) return;
    if (message.type() === 'warning' && !REACT_COMPLAINT.test(text)) return;
    found.push(`console.${message.type()}: ${text}`);
  });

  return found;
};

test.describe('React runtime', () => {
  test('the content script renders highlights without runtime errors', async ({
    page,
    context,
    extensionId,
  }) => {
    const errors = watchForRuntimeErrors(page);

    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    expect(errors).toEqual([]);
  });

  test('opening a popover does not raise runtime errors', async ({
    page,
    context,
    extensionId,
  }) => {
    // Covers the pieces most exposed to a React major: the floating-ui
    // positioning in HighlightPopover and the react-spring Arrow animation.
    const errors = watchForRuntimeErrors(page);

    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'chairman');

    expect(errors).toEqual([]);
  });

  test('a contenteditable renders without runtime errors', async ({
    page,
    context,
    extensionId,
  }) => {
    const errors = watchForRuntimeErrors(page);

    await signIn(context, extensionId);
    await page.goto('/contenteditable.html');
    await typeAndWaitForHighlights(page);

    expect(errors).toEqual([]);
  });

  test('the popup renders without runtime errors', async ({
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);

    const popup = await context.newPage();
    const errors = watchForRuntimeErrors(popup);
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('the options page renders without runtime errors', async ({
    context,
    extensionId,
  }) => {
    const options = await context.newPage();
    const errors = watchForRuntimeErrors(options);
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
