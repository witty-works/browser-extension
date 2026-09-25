const { test, expect } = require('@playwright/test');

const { blockExternalRequests } = require('../helpers/mockApi');

/**
 * Automated accessibility checks (axe-core) of the editor in each of its
 * states: the toolbar, the open W menu, both panels, and the popover. They
 * catch what rules can (roles, names, contrast, ARIA misuse); keyboard flows
 * are asserted in editor.spec.js, and screen reader testing stays manual.
 */
const AXE = require.resolve('axe-core/axe.min.js');
const ALTERNATIVE = '.witty-works-ext-wittyworks-popover-alternative-btn';

test.beforeEach(async ({ context, page }) => {
  await blockExternalRequests(context);
  await page.goto('/editor.html');
  await page.addScriptTag({ path: AXE });
  await expect(
    page.locator('.ProseMirror .witty-alert', { hasText: 'guys' })
  ).toBeVisible();
});

/** axe's violations on the editor, without the fixture page around it. */
const violations = (page) =>
  page.evaluate(async () => {
    const result = await window.axe.run('#editor', {
      resultTypes: ['violations'],
    });
    return result.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target.join(' ')),
    }));
  });

const menu = (page) => page.getByRole('button', { name: 'Witty menu' });

test('the editor with its toolbar and highlights', async ({ page }) => {
  expect(await violations(page)).toEqual([]);
});

test('the open W menu', async ({ page }) => {
  await menu(page).click();
  await expect(page.getByRole('menu')).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the settings panel', async ({ page }) => {
  await menu(page).click();
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(page.locator('select[data-field]').first()).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the gender format panel', async ({ page }) => {
  await menu(page).click();
  await page.getByRole('menuitem', { name: /Switch gender format/ }).click();
  await expect(
    page.locator('.witty-editor-switch-format').first()
  ).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the popover', async ({ page }) => {
  await page.locator('.ProseMirror .witty-alert', { hasText: 'guys' }).click();
  await expect(page.locator(ALTERNATIVE).first()).toBeVisible();

  // The popover renders into the page, next to the editor.
  const result = await page.evaluate(async () => {
    const { violations: found } = await window.axe.run(
      '#witty-works-ext-popover',
      { resultTypes: ['violations'] }
    );
    return found.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target.join(' ')),
    }));
  });
  expect(result).toEqual([]);
});
