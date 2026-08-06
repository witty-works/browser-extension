const path = require('node:path');
const { test: base, chromium, expect } = require('@playwright/test');

const { mockNlpApi, blockExternalRequests, SAMPLE_TEXT } = require('./mockApi');

const PATH_TO_EXTENSION = path.resolve(
  __dirname,
  '..',
  '..',
  'extension',
  'chrome'
);
const FIXTURE_ORIGIN = `http://localhost:${process.env.FIXTURE_PORT || 5174}`;

/**
 * Read the extension ID from the background service worker's URL.
 *
 * The previous helper navigated to https://www.witty.works/ and read the
 * `extension-id` attribute the content script writes there — which meant every
 * test needed the public site to be up, and only worked because that domain is
 * on EXPOSE_WITTY_ID_ALLOW_LIST. The service worker URL is always
 * `chrome-extension://<id>/js/background.bundle.js`, so the ID is available
 * locally and immediately.
 */
const getExtensionId = async (context) => {
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker');
  }

  return new URL(worker.url()).host;
};

/**
 * Put the extension into a signed-in state without running the OAuth flow.
 *
 * Driving a real sign-in would reintroduce the dependency this rewrite removes:
 * a reachable dashboard, a live OAuth client, and a shared test account whose
 * state other runs can change. `isSignedInResult` only needs a non-empty access
 * token, and the NLP API is mocked, so a fixture token is sufficient and the
 * token's contents are never inspected locally.
 */
const signIn = async (context, extensionId) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await page.evaluate(async () => {
    // Mirrors tokenStore's split: the bearer token goes to session storage, the
    // refresh token and the non-secret `signedIn` marker to local.
    await chrome.storage.session?.set({ accessToken: 'fixture-access-token' });
    await chrome.storage.local.set({
      signedIn: true,
      refreshToken: 'fixture-refresh-token',
      // Far enough out that no test run crosses it and triggers a refresh.
      accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
      checkEndpointSuccess: true,
      domains: [],
      organizationDomains: { list: [], type: 'deny' },
      spellChecking: true,
      apiDelay: 0,
    });
  });

  await page.close();
};

/**
 * Clear credentials, for the signed-out cases.
 */
const signOut = async (context, extensionId) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await page.evaluate(async () => {
    await chrome.storage.session?.set({ accessToken: '' });
    await chrome.storage.local.set({
      signedIn: false,
      accessToken: '',
      refreshToken: '',
      accessTokenExpiresAt: 0,
      checkEndpointSuccess: false,
    });
  });

  await page.close();
};

/**
 * Type text into a fixture editor and wait for the extension to render.
 *
 * Waits on the highlight container appearing rather than a fixed sleep — the
 * old suite slept 5s per interaction hoping the live API had answered, which is
 * both slow and racy. With a mocked API the response is immediate, so the only
 * real wait is the extension's own debounce.
 */
const editorText = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('#editor');
    if (!el) return '';
    return el instanceof HTMLTextAreaElement ? el.value : el.textContent || '';
  });

/**
 * Highlights are painted onto a canvas inside `ww-shadow-root-container`'s
 * shadow root.
 *
 * Do not wait on `ww-highlights` itself: it is a `display: inline` wrapper with
 * a 0x0 box, so Playwright correctly reports it as hidden even when highlights
 * have rendered perfectly. The canvas carries the actual pixels and has real
 * dimensions, which makes it the honest readiness signal.
 *
 * Plain `document.querySelector` does not cross shadow boundaries, hence the
 * explicit recursive walk.
 */
/**
 * Count non-transparent pixels across every canvas, piercing shadow roots.
 *
 * Element presence is not a usable signal: the extension creates the highlight
 * canvas whether or not anything is drawn on it. Painted pixels are.
 */
const PAINTED_PIXELS = `
  (() => {
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
        // A tainted or context-less canvas cannot be inspected.
        return 0;
      }
    };

    const walk = (root) => {
      let total = 0;
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === 'CANVAS') total += countPainted(el);
        if (el.shadowRoot) total += walk(el.shadowRoot);
      }
      return total;
    };

    return walk(document);
  })()
`;

const hasHighlightCanvas = async (page) =>
  (await page.evaluate(PAINTED_PIXELS)) > 0;

/**
 * Wait until highlights are painted *and* the painting has settled.
 *
 * Returning on the first painted pixel is not enough: the alerts are drawn over
 * several frames, so a screenshot taken at that moment can capture a partially
 * rendered canvas. That made the placement snapshots intermittently fail. This
 * requires two consecutive samples to agree before proceeding.
 */
const waitForHighlights = (page, timeout = 15000) =>
  page.waitForFunction(
    `(() => {
      const painted = ${PAINTED_PIXELS};
      const previous = window.__wwPaintedPixels;
      window.__wwPaintedPixels = painted;
      return painted > 0 && painted === previous;
    })()`,
    null,
    { timeout, polling: 250 }
  );

const setEditorText = async (page, text = SAMPLE_TEXT) => {
  const editor = page.locator('#editor');
  await editor.click();

  try {
    await editor.fill(text);
  } catch (error) {
    // `fill` can refuse on some contenteditable shapes; typing always works.
    await editor.pressSequentially(text, { delay: 0 });
  }

  // The extension keys off input events, and `fill` dispatches them — but if
  // the value never landed, typing is the fallback rather than waiting for a
  // highlight that can never appear.
  if (!(await editorText(page))) {
    await editor.pressSequentially(text, { delay: 0 });
  }
};

const typeAndWaitForHighlights = async (page, text = SAMPLE_TEXT) => {
  await setEditorText(page, text);
  await waitForHighlights(page);
};

const ALTERNATIVE_BTN = 'witty-works-ext-wittyworks-popover-alternative-btn';

/** Bounding boxes of every alternative button, shadow-DOM aware. */
const alternativeBoxes = (page) =>
  page.evaluate((cls) => {
    const found = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.classList.contains(cls)) {
          const r = el.getBoundingClientRect();
          found.push({
            text: el.textContent,
            x: Math.round(r.x),
            y: Math.round(r.y),
            width: Math.round(r.width),
            height: Math.round(r.height),
          });
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return found;
  }, ALTERNATIVE_BTN);

/**
 * Click the highlighted `word` to open its popover.
 *
 * The coordinate is measured rather than guessed: the fixture font is
 * proportional, so the x offset of a word is the rendered width of the text
 * before it. Guessing put the click on the wrong alert, which silently opened a
 * popover whose alternatives were all short — and therefore never exercised the
 * truncation path the popover tests exist to cover.
 */
const openPopoverForWord = async (page, word) => {
  const target = await page.evaluate((needle) => {
    const el = document.querySelector('#editor');
    const text = el instanceof HTMLTextAreaElement ? el.value : el.textContent;
    const index = text.indexOf(needle);
    if (index === -1) throw new Error(`fixture text has no "${needle}"`);

    const style = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = style.font || `${style.fontSize} ${style.fontFamily}`;

    const before = ctx.measureText(text.slice(0, index)).width;
    const half = ctx.measureText(needle).width / 2;
    const r = el.getBoundingClientRect();

    return {
      x:
        r.x +
        parseFloat(style.paddingLeft) +
        parseFloat(style.borderLeftWidth) +
        before +
        half,
      // Vertical middle of the first line.
      y:
        r.y +
        parseFloat(style.paddingTop) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.lineHeight) / 2,
    };
  }, word);

  await page.mouse.click(target.x, target.y);
  await page.waitForFunction(
    (cls) => {
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.classList.contains(cls)) return true;
          if (el.shadowRoot && walk(el.shadowRoot)) return true;
        }
        return false;
      };
      return walk(document);
    },
    ALTERNATIVE_BTN,
    { timeout: 15000 }
  );
};

/**
 * Playwright fixture that launches Chromium with the built extension.
 *
 * Extensions require a persistent context and a headed browser; Chromium's
 * headless mode does not load them.
 */
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

    // Order matters: Playwright matches route handlers in reverse registration
    // order, so the blanket blocker is registered first and the API mocks
    // registered after it take precedence.
    await blockExternalRequests(context);
    await mockNlpApi(context);

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    await use(await getExtensionId(context));
  },
});

module.exports = {
  test,
  expect,
  getExtensionId,
  signIn,
  signOut,
  setEditorText,
  waitForHighlights,
  hasHighlightCanvas,
  typeAndWaitForHighlights,
  alternativeBoxes,
  openPopoverForWord,
  ALTERNATIVE_BTN,
  FIXTURE_ORIGIN,
  PATH_TO_EXTENSION,
};
