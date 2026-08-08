const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
  openPopoverForWord,
  pressOpenPopoverShortcut,
  ALTERNATIVE_BTN,
} = require('./helpers/extension');

/**
 * Keyboard accessibility of the highlight popover (issue #927).
 *
 * The popover used to be mouse-only: it opened on click, its "buttons" were
 * divs, nothing responded to Enter/Space or Escape, and focus never entered
 * it. These tests cover the keyboard path end to end: the manifest command,
 * the background→content forwarding (entered one step in, see
 * pressOpenPopoverShortcut), opening/cycling/closing without a pointer, and
 * applying an alternative with Enter.
 */

/** The popover container, its ARIA wiring, and where focus currently is. */
const popoverState = (page) =>
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
    const popover = walk(document);
    if (!popover) return null;

    const status = popover.querySelector('[role="status"]');
    return {
      role: popover.getAttribute('role'),
      ariaLabel: popover.getAttribute('aria-label'),
      counter: status ? status.textContent.trim() : null,
      focusInside: popover.contains(document.activeElement),
    };
  });

const waitForPopover = (page) =>
  page.waitForFunction(
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
    null,
    { timeout: 15000 }
  );

const waitForCounter = (page, prefix) =>
  page.waitForFunction(
    (want) => {
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
      return !!status && status.textContent.trim().startsWith(want);
    },
    prefix,
    { timeout: 15000 }
  );

const activeElementId = (page) =>
  page.evaluate(() => document.activeElement?.id || null);

test.describe('Popover keyboard accessibility', () => {
  test('the manifest registers the open-popover command', async ({
    context,
    extensionId,
  }) => {
    // Ask the commands API from an extension page rather than the service
    // worker: evaluating in an idle MV3 worker can hang when nothing keeps
    // it alive.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const commands = await page.evaluate(() => chrome.commands.getAll());

    const command = commands.find((c) => c.name === 'open-highlight-popover');
    expect(
      command,
      'open-highlight-popover command is not registered'
    ).toBeTruthy();
    // Chrome resolves the __MSG_commandOpenPopover__ placeholder; an empty
    // description means the locale entry is missing.
    expect(command.description).not.toBe('');
    await page.close();
  });

  test('the shortcut opens the popover on the first alert and focuses it', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await pressOpenPopoverShortcut(context);
    await waitForPopover(page);

    const state = await popoverState(page);
    expect(state.role).toBe('dialog');
    expect(state.ariaLabel).not.toBeNull();
    expect(state.ariaLabel).not.toBe('');
    // Opens on the first of the three fixture alerts.
    expect(state.counter).toMatch(/^1\b/);
    // A keyboard-opened popover must take focus so Tab can reach its controls.
    expect(state.focusInside).toBe(true);
  });

  test('repeated shortcut presses cycle through the alerts and wrap around', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await pressOpenPopoverShortcut(context);
    await waitForCounter(page, '1');

    await pressOpenPopoverShortcut(context);
    await waitForCounter(page, '2');

    await pressOpenPopoverShortcut(context);
    await waitForCounter(page, '3');

    // Past the last alert the shortcut wraps back to the first, unlike the
    // arrow buttons, which stop at the ends.
    await pressOpenPopoverShortcut(context);
    await waitForCounter(page, '1');
  });

  test('Escape closes the popover and returns focus to the input', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await pressOpenPopoverShortcut(context);
    await waitForPopover(page);

    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.id === 'witty-works-ext-popover') return true;
          if (el.shadowRoot && walk(el.shadowRoot)) return true;
        }
        return false;
      };
      return !walk(document);
    });

    expect(await activeElementId(page)).toBe('editor');
  });

  test('Enter on an alternative applies it and returns focus to the input', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);

    await pressOpenPopoverShortcut(context);
    await waitForPopover(page);

    // Tab from the dialog container to the first alternative button. The
    // bound is generous; what matters is that Tab can reach it at all.
    let onAlternative = false;
    for (let i = 0; i < 15 && !onAlternative; i += 1) {
      await page.keyboard.press('Tab');
      onAlternative = await page.evaluate(
        (cls) => document.activeElement?.classList?.contains(cls) ?? false,
        ALTERNATIVE_BTN
      );
    }
    expect(onAlternative, 'Tab never reached an alternative button').toBe(true);

    await page.keyboard.press('Enter');

    // First alert is "guys", whose first alternative is "everyone".
    await page.waitForFunction(() => {
      const el = document.querySelector('#editor');
      return el && el.value.includes('everyone') && !el.value.includes('guys');
    });
    // Replacing targets the focused element, so focus must be back on it.
    expect(await activeElementId(page)).toBe('editor');
  });

  test('a mouse-opened popover leaves focus in the input', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'chairman');

    // The keyboard flow moves focus into the popover; the mouse flow must
    // never do that — it would rip focus away mid-typing.
    const state = await popoverState(page);
    expect(state.focusInside).toBe(false);
    expect(await activeElementId(page)).toBe('editor');
  });

  test('popover controls are real buttons', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'chairman');

    // role="button" divs announce as buttons but ignore Enter/Space; only
    // real <button> elements make the popover operable by keyboard.
    const tags = await page.evaluate((cls) => {
      const found = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.classList.contains(cls)) found.push(el.tagName);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return found;
    }, ALTERNATIVE_BTN);

    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toBe('BUTTON');
    }
  });
});
