const { test: base, chromium, expect } = require('@playwright/test');

const {
  getExtensionId,
  signIn,
  setEditorText,
  measureWordCenter,
  ALTERNATIVE_BTN,
  PATH_TO_EXTENSION,
} = require('../helpers/extension');
const { mockNlpApi, blockExternalRequests } = require('../helpers/mockApi');

/**
 * The release build, as users get it. Its shadow roots are closed, while the
 * test build used by the rest of the suite opens them so that tests can look
 * inside (ContentScript/shadowHosts.tsx). Code that reaches into a root
 * through `host.shadowRoot` works in the test build and breaks only here.
 *
 * Neither page scripts nor Playwright's locators see into a closed root; the
 * DevTools protocol does (`pierce`), so this suite reads the extension's
 * elements through it and acts on the page only as a user would: by clicking
 * at a position.
 *
 * Build with `npm run build:chrome` first; `npm run test:release` does this.
 */

/**
 * The release build starts the OAuth sign-in on install, before any route
 * can be registered, and reports errors to Sentry with the build's config.
 * Every hostname but the fixture server's resolves to nothing, so neither
 * reaches a real dashboard or Sentry project; the routes then answer the
 * mocked API as in the rest of the suite.
 */
const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: [
        `--disable-extensions-except=${PATH_TO_EXTENSION}`,
        `--load-extension=${PATH_TO_EXTENSION}`,
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      ],
    });
    await blockExternalRequests(context);
    await mockNlpApi(context);
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    await use(await getExtensionId(context));
  },
});

/** Run `read` on every node of the page, closed shadow roots included. */
const withPiercedNodes = async (page, read) => {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', {
      depth: -1,
      pierce: true,
    });
    const nodes = [];
    const walk = (node, closedRoot) => {
      nodes.push({ ...node, closedRoot });
      for (const child of node.children || []) walk(child, closedRoot);
      for (const shadow of node.shadowRoots || []) {
        walk(shadow, closedRoot || shadow.shadowRootType === 'closed');
      }
    };
    walk(root, false);
    return await read(nodes, cdp);
  } finally {
    await cdp.detach();
  }
};

const hasClass = (node, name) => {
  const attributes = node.attributes || [];
  const index = attributes.indexOf('class');
  return index >= 0 && attributes[index + 1].split(/\s+/).includes(name);
};

/** The text of a node and its descendants. */
const textOf = (node) =>
  node.nodeType === 3
    ? node.nodeValue
    : (node.children || []).map(textOf).join('');

const alternativeButtons = (nodes) =>
  nodes.filter((node) => hasClass(node, ALTERNATIVE_BTN));

/** The field's text, from a textarea or a contenteditable element. */
const fieldText = (page) =>
  page
    .locator('#editor')
    .evaluate((field) =>
      field instanceof HTMLTextAreaElement ? field.value : field.textContent
    );

test.describe('Release build', () => {
  test('keeps its shadow roots closed to the page', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await setEditorText(page);

    const roots = () =>
      withPiercedNodes(page, (nodes) => ({
        closed: nodes.filter((node) => node.shadowRootType === 'closed').length,
        open: nodes.filter((node) => node.shadowRootType === 'open').length,
      }));
    await expect.poll(async () => (await roots()).closed).toBeGreaterThan(0);
    expect((await roots()).open).toBe(0);
  });

  for (const fixture of ['textarea', 'contenteditable']) {
    test(`replaces a flagged word with the alternative clicked (${fixture})`, async ({
      page,
      context,
      extensionId,
    }) => {
      await signIn(context, extensionId);
      await page.goto(`/${fixture}.html`);
      await setEditorText(page);

      // The highlight cannot be read from the page. The word is clicked as
      // a user would, and again only if no popover came within two seconds.
      const word = await page.evaluate(measureWordCenter, 'chairman');
      let opened = false;
      for (let attempt = 0; attempt < 10 && !opened; attempt += 1) {
        await page.mouse.click(word.x, word.y);
        opened = await expect
          .poll(
            () =>
              withPiercedNodes(
                page,
                (nodes) => alternativeButtons(nodes).length
              ),
            { timeout: 2000 }
          )
          .toBeGreaterThan(0)
          .then(
            () => true,
            () => false
          );
      }
      expect(opened).toBe(true);

      const { chosen, closedRoot, centre } = await withPiercedNodes(
        page,
        async (nodes, cdp) => {
          const [first] = alternativeButtons(nodes);
          const { model } = await cdp.send('DOM.getBoxModel', {
            backendNodeId: first.backendNodeId,
          });
          const [x1, y1, , , x3, y3] = model.content;
          return {
            chosen: textOf(first).trim(),
            closedRoot: first.closedRoot,
            centre: { x: (x1 + x3) / 2, y: (y1 + y3) / 2 },
          };
        }
      );
      expect(closedRoot).toBe(true);
      await page.mouse.click(centre.x, centre.y);

      await expect.poll(() => fieldText(page)).toContain(chosen);
      expect(await fieldText(page)).not.toContain('chairman');
    });
  }
});
