const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
} = require('./helpers/extension');

/**
 * The pin notification, and specifically the image in it.
 *
 * It used to be loaded straight from https://www.witty.works/assets/media/,
 * which works on a permissive page and silently fails everywhere else: the
 * notification is injected into the *host* document, so the host page's
 * img-src governs it, and a strict policy blocks a third-party URL outright.
 *
 * See cspProbe.spec.js for the measurement — of the available options only the
 * extension's own origin survives such a policy. data: and blob: do not, so
 * inlining the bytes would not have helped.
 */

/** The pin image's load state, shadow-DOM aware. */
const pinImageState = (page) =>
  page.evaluate(() => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('img')) {
        if (el.classList.contains('witty-works-pin-gif')) {
          return {
            src: el.src,
            complete: el.complete,
            naturalWidth: el.naturalWidth,
          };
        }
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          const hit = walk(el.shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(document);
  });

/**
 * Waits on the image itself rather than on #ww-notification: the notification
 * is inserted as a wrapper plus content sharing that id, and the first match is
 * a zero-size element that never satisfies a visibility check.
 */
const waitForPinImage = async (page) => {
  await page.waitForFunction(
    () => {
      const img = document.querySelector('img.witty-works-pin-gif');
      return Boolean(img && img.complete);
    },
    null,
    { timeout: 20000 }
  );
  return pinImageState(page);
};

test.describe('Pin notification', () => {
  for (const [label, fixture] of [
    ['an ordinary page', '/textarea.html'],
    ['a page with a strict img-src', '/csp.html'],
  ]) {
    test(`renders its image on ${label}`, async ({
      page,
      context,
      extensionId,
    }) => {
      await signIn(context, extensionId);
      await page.goto(fixture);
      // The content script mounts against an editable field, so the
      // notification only appears once one is in use.
      await typeAndWaitForHighlights(page);

      const image = await waitForPinImage(page);

      expect(image, 'pin image was not rendered').not.toBeNull();
      // Served by the extension, not fetched from the website.
      expect(image.src).toMatch(/^chrome-extension:\/\//);
      // naturalWidth is 0 for an image the browser refused to load, which is
      // exactly what a blocked request looks like — `complete` alone is true
      // either way and would not catch it.
      expect(
        image.naturalWidth,
        'pin image did not actually load'
      ).toBeGreaterThan(0);
    });
  }
});
