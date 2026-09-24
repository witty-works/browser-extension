const { test, expect } = require('@playwright/test');

const { blockExternalRequests } = require('../helpers/mockApi');

/**
 * The editor package in a real browser: the published bundle on
 * fixtures/editor.html, checking against the fixture server's mock API. The
 * unit tests cover the logic; these cover what needs layout and real events.
 */
const ALTERNATIVE = '.witty-works-ext-wittyworks-popover-alternative-btn';

test.beforeEach(async ({ context, page }) => {
  // Nothing may reach the internet; everything is served by the fixture server.
  await blockExternalRequests(context);
  await page.goto('/editor.html');
});

const highlight = (page, word) =>
  page.locator('.ProseMirror .witty-alert', { hasText: word });

test('underlines what the API flags', async ({ page }) => {
  await expect(highlight(page, 'guys')).toBeVisible();
  await expect(highlight(page, 'chairman')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.statuses.at(-1)))
    .toEqual({ state: 'idle', alerts: 3, limitReached: false });
});

test('opens the popover by clicking a highlight and applies an alternative', async ({
  page,
}) => {
  await highlight(page, 'guys').click();

  const everyone = page.locator(ALTERNATIVE, { hasText: 'everyone' });
  await expect(everyone).toBeVisible();
  await everyone.click();

  await expect(page.locator('.ProseMirror')).toContainText(
    'Hey everyone, the chairman'
  );
  await expect(page.locator(ALTERNATIVE)).toHaveCount(0);
});

test('opens the popover at the cursor with Alt+Shift+W', async ({ page }) => {
  // The caret into "guys" from the start of the text, without a click on it.
  await page.locator('.ProseMirror p').click({ position: { x: 2, y: 5 } });
  await page.keyboard.press('Home');
  for (let step = 0; step < 5; step += 1)
    await page.keyboard.press('ArrowRight');
  await expect(page.locator(ALTERNATIVE)).toHaveCount(0);

  await page.keyboard.press('Alt+Shift+W');

  await expect(page.locator(ALTERNATIVE).first()).toBeVisible();
});

test('opens the Witty menu from the W icon', async ({ page }) => {
  await page.getByRole('button', { name: 'Witty menu' }).click();

  await expect(page.getByRole('menuitem')).toHaveText([
    'Settings…',
    'Switch gender format…',
    'Help',
    'About Witty',
  ]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Witty menu' })).toBeFocused();
});
