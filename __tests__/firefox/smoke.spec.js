const {
  test,
  expect,
  signIn,
  openExtensionPage,
  openFixture,
  poll,
  typeAndWaitForHighlights,
  openPopoverForWord,
  ALTERNATIVE_BTN,
  FIXTURE_ORIGIN,
} = require('./helpers');

/**
 * Firefox smoke suite: one test per load-bearing path, not a mirror of the
 * Chromium suite. What it cannot cover — the MV2→MV3 update path, the real
 * keyboard shortcut, toolbar badge and button, OAuth — stays on the manual
 * Firefox QA checklist.
 */
test.describe('Firefox smoke', () => {
  test('the popup renders signed out, then signed in', async ({ firefox }) => {
    const signedOut = await openExtensionPage(firefox, 'popup.html');
    await signedOut.waitForSelector('.witty-works-ext-primary-button-red');
    await signedOut.close();

    await signIn(firefox);
    const signedIn = await openExtensionPage(firefox, 'popup.html');
    await signedIn.waitForSelector('.witty-works-ext-toggle-encloser');
  });

  test('the options page renders its endpoint form', async ({ firefox }) => {
    const options = await openExtensionPage(firefox, 'options.html');
    await options.waitForSelector('#dashboard-url');
    await options.waitForSelector('#api-url');
  });

  test('the background script answers runtime messages', async ({
    firefox,
  }) => {
    await signIn(firefox);
    const page = await openExtensionPage(firefox, 'popup.html');

    const reply = await page.evaluate(() =>
      browser.runtime.sendMessage({ type: 'witty:sign-out' })
    );
    expect(reply).toEqual({ status: 'success' });

    // The reply alone could come from anywhere; the sign-out is observable.
    await poll(() =>
      page.evaluate(async () => {
        const { signedIn } = await browser.storage.local.get('signedIn');
        return signedIn === false;
      })
    );
  });

  test('registers the open-popover command', async ({ firefox }) => {
    const page = await openExtensionPage(firefox, 'popup.html');
    const commands = await page.evaluate(() => browser.commands.getAll());
    expect(commands.map((c) => c.name)).toContain('open-highlight-popover');
  });

  test('highlights a textarea and applies an alternative', async ({
    firefox,
  }) => {
    await signIn(firefox);
    const page = await openFixture(firefox, 'textarea.html');
    await typeAndWaitForHighlights(page);

    await openPopoverForWord(page, 'guys');
    const box = await page.evaluate((cls) => {
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.classList.contains(cls) && el.textContent.includes('everyone')) {
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
          const hit = el.shadowRoot && walk(el.shadowRoot);
          if (hit) return hit;
        }
        return null;
      };
      return walk(document);
    }, ALTERNATIVE_BTN);
    expect(box, 'no "everyone" alternative in the popover').not.toBeNull();
    await page.mouse.click(box.x, box.y);

    await page.waitForFunction(() => {
      const { value } = document.querySelector('#editor');
      return value.includes('everyone') && !value.includes('guys');
    });
  });

  test('highlights a contenteditable', async ({ firefox }) => {
    await signIn(firefox);
    const page = await openFixture(firefox, 'contenteditable.html');
    await typeAndWaitForHighlights(page);
  });

  test('the content script answers the open-popover message', async ({
    firefox,
  }) => {
    await signIn(firefox);
    // Opened first: the message acts on the focused field, so the fixture
    // tab has to be the one that ends up in front.
    const extensionPage = await openExtensionPage(firefox, 'popup.html');
    const page = await openFixture(firefox, 'textarea.html');
    await page.bringToFront();
    await typeAndWaitForHighlights(page);

    // The real shortcut is browser UI and cannot be pressed from automation;
    // this is the message the background forwards when it fires.
    await extensionPage.evaluate(async (origin) => {
      // Match patterns cannot carry the fixture server's port; filter instead.
      const tab = (await browser.tabs.query({})).find((t) =>
        t.url?.startsWith(origin)
      );
      await browser.tabs.sendMessage(tab.id, { type: 'witty:open-popover' });
    }, FIXTURE_ORIGIN);

    await page.waitForFunction(
      () => {
        const walk = (root) => {
          for (const el of root.querySelectorAll('*')) {
            if (el.id === 'witty-works-ext-popover') return true;
            if (el.shadowRoot && walk(el.shadowRoot)) return true;
          }
          return false;
        };
        return walk(document);
      },
      { timeout: 15000 }
    );
  });
});
