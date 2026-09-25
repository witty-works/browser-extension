const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
  openPopoverForWord,
  pressOpenPopoverShortcut,
} = require('./helpers/extension');

/**
 * The highlight popover's ignore flows (HighlightPopover.tsx `handleIgnoreClick`,
 * Input.tsx `addIgnoredTerm`) are the one popover behavior the suite did not
 * cover before this file. Added as a guard rail ahead of a refactor of that
 * code.
 *
 * Two controls:
 *  - "Ignore once" is local: it adds the term to in-memory `ignoredTerms` and
 *    closes the popover synchronously. No network call.
 *  - "Ignore permanently" PUTs to the dashboard's
 *    `api/user/language/ignore-words?false_positive=<term>` and only calls
 *    `addIgnoredTerm` once the response is a 204.
 *
 * Both are exercised through their effect on the alert list (fetched via
 * `openPopoverForWord`'s counter, "N of total") rather than by inspecting
 * `ignoredTerms` directly, since that state is private to Input.tsx.
 */

/** Bounding-box center of the first element with the given aria-label, shadow-DOM aware. */
const centerOfAriaLabel = (page, label) =>
  page.evaluate((wanted) => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.getAttribute && el.getAttribute('aria-label') === wanted) {
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
        if (el.shadowRoot) {
          const hit = walk(el.shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(document);
  }, label);

const existsByAriaLabel = (page, label) =>
  page.evaluate((wanted) => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.getAttribute && el.getAttribute('aria-label') === wanted) {
          return true;
        }
        if (el.shadowRoot && walk(el.shadowRoot)) return true;
      }
      return false;
    };
    return walk(document);
  }, label);

// Inlined for `page.waitForFunction`, which serializes its function to a
// string and cannot close over `existsByAriaLabel`'s `page.evaluate` wrapper.
function existsByAriaLabelBrowser(wanted) {
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.getAttribute && el.getAttribute('aria-label') === wanted) {
        return true;
      }
      if (el.shadowRoot && walk(el.shadowRoot)) return true;
    }
    return false;
  };
  return walk(document);
}

/** Click a control identified by its aria-label; waits for it to exist first. */
const clickByAriaLabel = async (page, label) => {
  await page.waitForFunction(existsByAriaLabelBrowser, label, {
    timeout: 15000,
  });
  const center = await centerOfAriaLabel(page, label);
  await page.mouse.click(center.x, center.y);
};

// Inlined for `page.waitForFunction`, same constraint as
// `existsByAriaLabelBrowser` above.
function textIsVisibleBrowser(wanted) {
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (
        Array.from(el.childNodes || []).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.includes(wanted)
        )
      ) {
        return true;
      }
      if (el.shadowRoot && walk(el.shadowRoot)) return true;
    }
    return false;
  };
  return walk(document);
}

/** Wait until some element's own text contains the given string, shadow-DOM aware. */
const waitForTextVisible = (page, text, timeout = 15000) =>
  page.waitForFunction(textIsVisibleBrowser, text, { timeout });

/** "N of total" counter text from the currently open popover. */
const counterText = (page) =>
  page.evaluate(() => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.id === 'witty-works-ext-popover') return el;
        if (el.shadowRoot) {
          const hit = walk(el.shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    };
    const status = walk(document)?.querySelector('[role="status"]');
    return status ? status.textContent.trim() : null;
  });

const popoverIsOpen = (page) =>
  page.evaluate(() => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.id === 'witty-works-ext-popover') return true;
        if (el.shadowRoot && walk(el.shadowRoot)) return true;
      }
      return false;
    };
    return walk(document);
  });

const waitForPopoverClosed = (page) =>
  page.waitForFunction(() => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.id === 'witty-works-ext-popover') return true;
        if (el.shadowRoot && walk(el.shadowRoot)) return true;
      }
      return false;
    };
    return !walk(document);
  });

/** Route matcher for the dashboard's ignore-words endpoint, host-agnostic like mockApi.js. */
const IGNORE_WORDS_PATH = '/api/user/language/ignore-words';

test.describe('Popover ignore flows', () => {
  test('ignore once hides the alert locally, without contacting the dashboard', async ({
    page,
    context,
    extensionId,
  }) => {
    const ignoreRequests = [];
    await context.route(
      (url) => url.pathname.includes(IGNORE_WORDS_PATH),
      (route) => {
        ignoreRequests.push({
          method: route.request().method(),
          url: route.request().url(),
        });
        return route.fulfill({ status: 204, body: '' });
      }
    );

    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await openPopoverForWord(page, 'guys');
    expect(await counterText(page)).toBe('1 of 3');

    await clickByAriaLabel(page, 'Ignore once');
    await waitForPopoverClosed(page);

    // The ignored alert ("guys") is gone: three alerts become two, and
    // "chairman" — previously second — is now first.
    await openPopoverForWord(page, 'chairman');
    expect(await counterText(page)).toBe('1 of 2');

    expect(ignoreRequests, 'ignore once must not call the dashboard').toEqual(
      []
    );
  });

  test('ignore permanently PUTs the term to the dashboard and hides the alert on success', async ({
    page,
    context,
    extensionId,
  }) => {
    const ignoreRequests = [];
    await context.route(
      (url) => url.pathname.includes(IGNORE_WORDS_PATH),
      (route) => {
        ignoreRequests.push({
          method: route.request().method(),
          url: route.request().url(),
        });
        return route.fulfill({ status: 204, body: '' });
      }
    );

    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await openPopoverForWord(page, 'guys');
    expect(await counterText(page)).toBe('1 of 3');

    await clickByAriaLabel(page, 'Ignore permanently');

    await expect
      .poll(() => ignoreRequests.length, {
        message: 'expected one PUT to the ignore-words endpoint',
      })
      .toBe(1);
    expect(ignoreRequests[0].method).toBe('PUT');
    expect(ignoreRequests[0].url).toContain(`${IGNORE_WORDS_PATH}?`);
    expect(ignoreRequests[0].url).toContain('false_positive=guys');

    /**
     * On success the popover shows the check mark briefly and then closes
     * itself (~1s). Historically this never worked: the delayed close used
     * `browser.alarms`, an API content scripts cannot access at all, and the
     * throw was silently swallowed — so the popover stayed open forever. The
     * de-browserification of the popover (EDITOR_COMPONENT_PLAN.md Phase 1
     * item 4) replaced it with a plain timeout, restoring the intended
     * behavior, which is what is pinned here.
     */
    await waitForPopoverClosed(page);

    // And the ignore took effect: reopening elsewhere shows "guys" gone.
    await openPopoverForWord(page, 'chairman');
    expect(await counterText(page)).toBe('1 of 2');
  });

  test('keyboard-activated ignore permanently returns focus to the input after the auto-close', async ({
    page,
    context,
    extensionId,
  }) => {
    await context.route(
      (url) => url.pathname.includes(IGNORE_WORDS_PATH),
      (route) => route.fulfill({ status: 204, body: '' })
    );

    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    // Open via the keyboard shortcut: focus moves into the popover dialog.
    await pressOpenPopoverShortcut(page.context());
    await page.waitForFunction(() =>
      document
        .getElementById('witty-works-ext-popover')
        ?.contains(document.activeElement)
    );

    // Tab to the "Ignore permanently" button and activate it.
    let onIgnore = false;
    for (let i = 0; i < 20 && !onIgnore; i += 1) {
      await page.keyboard.press('Tab');
      onIgnore = await page.evaluate(
        () =>
          document.activeElement?.getAttribute('aria-label') ===
          'Ignore permanently'
      );
    }
    expect(onIgnore, 'Tab never reached "Ignore permanently"').toBe(true);
    await page.keyboard.press('Enter');

    await waitForPopoverClosed(page);

    // The auto-close removed the focused button; focus must return to the
    // input (matching the Escape path), not fall back to <body>.
    expect(await page.evaluate(() => document.activeElement?.id || null)).toBe(
      'editor'
    );
  });

  test('ignore permanently shows a failure state and keeps the alert when the request fails', async ({
    page,
    context,
    extensionId,
  }) => {
    const ignoreRequests = [];
    await context.route(
      (url) => url.pathname.includes(IGNORE_WORDS_PATH),
      (route) => {
        ignoreRequests.push({ method: route.request().method() });
        return route.fulfill({ status: 500, body: '' });
      }
    );

    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await openPopoverForWord(page, 'guys');
    await clickByAriaLabel(page, 'Ignore permanently');

    await expect.poll(() => ignoreRequests.length).toBe(1);
    await waitForTextVisible(page, 'Failed, please try again');

    // A failed request must not ignore the term: the popover is untouched and
    // the alert is still there to retry.
    expect(await popoverIsOpen(page)).toBe(true);
    expect(await counterText(page)).toBe('1 of 3');
  });

  test('API-key mode hides the ignore-permanently control', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    const setupPage = await context.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await setupPage.evaluate(async () => {
      // `isDashboardAvailable` (source/shared/constants.ts) keys off `authMode`
      // alone, but `isSignedInResult` additionally requires a real API-key
      // record matching the active endpoint in API-key mode — without one the
      // extension treats itself as signed out and never checks any text. This
      // build's `DefaultBaseUrlKey` is 'Prod' (production build, no stored
      // `apiEndpoint` override), so the record must be keyed the same way.
      await chrome.storage.local.set({
        authMode: 'apiKey',
        apiKey: { endpoint: 'Prod', value: 'fixture-api-key' },
      });
    });
    await setupPage.close();

    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'guys');

    expect(await existsByAriaLabel(page, 'Ignore once')).toBe(true);
    expect(await existsByAriaLabel(page, 'Ignore permanently')).toBe(false);
  });
});
