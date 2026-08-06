const { test, expect } = require('./helpers/extension');

/**
 * Diagnostic, not a product assertion: establishes which image sources survive
 * a host page's restrictive img-src, so the fix for the extension's images is
 * chosen on evidence rather than on folklore about extension-origin exemptions.
 */
test('which image sources survive a strict host-page CSP', async ({
  page,
  extensionId,
}) => {
  await page.goto('/csp.html');

  const results = await page.evaluate(
    async ({ id }) => {
      const tryLoad = (label, src) =>
        new Promise((resolve) => {
          const img = new Image();
          const done = (loaded) => resolve({ label, loaded });
          img.onload = () => done(true);
          img.onerror = () => done(false);
          img.src = src;
          setTimeout(() => done(false), 4000);
        });

      return Promise.all([
        tryLoad('same-origin', '/dot.gif'),
        tryLoad(
          'remote https',
          'https://www.witty.works/assets/media/pin_witty-2.gif'
        ),
        tryLoad(
          'data: uri',
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        ),
        tryLoad(
          'chrome-extension://',
          `chrome-extension://${id}/assets/media/pin-witty.gif`
        ),
        // The candidate for API-supplied images: fetch the bytes somewhere the
        // page CSP does not reach, then hand the page a blob.
        tryLoad(
          'blob:',
          URL.createObjectURL(
            new Blob(
              [
                Uint8Array.from(
                  atob(
                    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                  ),
                  (c) => c.charCodeAt(0)
                ),
              ],
              { type: 'image/gif' }
            )
          )
        ),
      ]);
    },
    { id: extensionId }
  );

  // Printed so the outcome is visible in CI logs, not just asserted away.
  for (const r of results) {
    console.log(
      `  [csp probe] ${r.label.padEnd(22)} ${r.loaded ? 'LOADS' : 'blocked'}`
    );
  }

  expect(results.length).toBe(5);
});
