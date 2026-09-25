const fs = require('node:fs');
const path = require('node:path');
const { test: base, expect, chromium } = require('@playwright/test');

const { mockNlpApi } = require('./helpers/mockApi');
const {
  getExtensionId,
  signIn,
  PATH_TO_EXTENSION,
} = require('./helpers/extension');

/**
 * Live Google Docs smoke test — local-only.
 *
 * Runs against a real, world-editable scratch document whose URL lives in
 * __tests__/local.config.json (gitignored — the link grants write access and
 * must never land in the public repo; see local.config.json.example). When
 * the config is absent, e.g. in CI, the suite skips itself.
 *
 * Unlike the fixture suites this cannot block non-localhost traffic — the
 * whole point is loading docs.google.com — but the NLP API stays mocked, so
 * only Google is real. Expect some flakiness: the doc is shared mutable
 * state, and Google occasionally interposes consent pages.
 */

const localConfigPath = path.join(__dirname, 'local.config.json');
const localConfig = fs.existsSync(localConfigPath)
  ? JSON.parse(fs.readFileSync(localConfigPath, 'utf8'))
  : null;
const docUrl = localConfig?.googleDocsUrl;

const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: [
        `--disable-extensions-except=${PATH_TO_EXTENSION}`,
        `--load-extension=${PATH_TO_EXTENSION}`,
      ],
    });

    await mockNlpApi(context);

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    await use(await getExtensionId(context));
  },
});

/**
 * Count painted pixels only on the extension's own canvases. Google Docs
 * renders the document itself onto canvases, so the generic painted-pixels
 * helper would report highlights before the extension drew anything. The
 * extension mounts everything under ww-* custom elements, which Google's own
 * DOM never contains.
 */
const extensionHighlightPixels = (page) =>
  page.evaluate(() => {
    const countPainted = (canvas) => {
      if (!canvas.width || !canvas.height) return 0;
      try {
        const { data } = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height);
        let n = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) n += 1;
        }
        return n;
      } catch (error) {
        return 0;
      }
    };

    const walk = (root, insideWitty) => {
      let total = 0;
      for (const el of root.querySelectorAll('*')) {
        const inWitty = insideWitty || el.tagName.startsWith('WW-');
        if (el.tagName === 'CANVAS' && inWitty) total += countPainted(el);
        if (el.shadowRoot) total += walk(el.shadowRoot, inWitty);
      }
      return total;
    };

    return walk(document, false);
  });

test.describe('Google Docs (live, local-only)', () => {
  // A live external dependency is inherently flaky (load latency, consent
  // interstitials, shared doc state) — retry before calling it a failure.
  test.describe.configure({ retries: 2 });

  test.skip(
    !docUrl,
    'no __tests__/local.config.json with googleDocsUrl — see local.config.json.example'
  );

  test('highlights typed text in a real document', async ({
    page,
    context,
    extensionId,
  }) => {
    test.setTimeout(180_000);

    await signIn(context, extensionId);
    await page.goto(docUrl, { waitUntil: 'domcontentloaded' });

    // The kix editor is up when its event-target iframe exists.
    await page.waitForSelector('.docs-texteventtarget-iframe', {
      state: 'attached',
      timeout: 60_000,
    });
    // Give the editor a beat to finish wiring before typing.
    await page.waitForTimeout(3_000);

    // Focus the document body and start from a clean slate — the doc is a
    // shared scratch pad, so whatever a previous run left behind goes first.
    await page.click('.kix-appview-editor');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);

    await page.keyboard.type(
      'Hey guys, the chairman will assume the leadership role.',
      { delay: 20 }
    );

    // The extension paints its highlights onto its own ww-* canvases; two
    // consecutive equal non-zero samples = painted and settled.
    let previous = -1;
    await expect
      .poll(
        async () => {
          const painted = await extensionHighlightPixels(page);
          const settled = painted > 0 && painted === previous;
          previous = painted;
          return settled;
        },
        { timeout: 60_000, intervals: [1_000] }
      )
      .toBe(true);

    // Leave the shared doc empty for the next run.
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1_000);
  });
});
