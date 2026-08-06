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

      /**
       * Inline SVG markup, as opposed to an <img> pointing at an SVG file.
       * This is the interesting case for server-supplied logos: markup is DOM,
       * not a fetched subresource, so img-src should not apply to it at all.
       * Verified by painted geometry rather than by an onload event, which
       * inline markup does not fire.
       */
      const tryInlineSvg = (label) =>
        new Promise((resolve) => {
          const host = document.createElement('div');
          host.innerHTML =
            '<svg width="40" height="40" viewBox="0 0 40 40">' +
            '<rect width="40" height="40" fill="#f06464"></rect></svg>';
          document.body.appendChild(host);
          requestAnimationFrame(() => {
            const svg = host.querySelector('svg');
            const box = svg && svg.getBoundingClientRect();
            resolve({ label, loaded: Boolean(box && box.width >= 40) });
          });
        });

      // iframes and <video> are governed by frame-src and media-src, which are
      // separate directives from img-src — an extension-origin exemption for
      // one does not imply it for the others.
      const tryFrame = (label, src) =>
        new Promise((resolve) => {
          const f = document.createElement('iframe');
          f.style.display = 'none';
          f.onload = () => resolve({ label, loaded: true });
          f.onerror = () => resolve({ label, loaded: false });
          document.addEventListener('securitypolicyviolation', (e) => {
            if (e.blockedURI && src.startsWith(e.blockedURI.slice(0, 20))) {
              resolve({ label, loaded: false });
            }
          });
          f.src = src;
          document.body.appendChild(f);
          setTimeout(() => resolve({ label, loaded: false }), 4000);
        });

      const tryMedia = (label, src) =>
        new Promise((resolve) => {
          const v = document.createElement('video');
          v.muted = true;
          v.onloadedmetadata = () => resolve({ label, loaded: true });
          v.onerror = () => resolve({ label, loaded: false });
          v.src = src;
          setTimeout(() => resolve({ label, loaded: false }), 4000);
        });

      return Promise.all([
        tryInlineSvg('inline svg markup'),
        tryFrame('frame: extension', `chrome-extension://${id}/options.html`),
        tryFrame('frame: remote', 'https://www.youtube.com/embed/dQw4w9WgXcQ'),
        // No extension-origin counterpart: the extension ships no video, and
        // pointing <video> at the gif would report "blocked" for the wrong
        // reason — a decode failure, not the policy.
        tryMedia(
          'video: remote',
          'https://www.witty.works/assets/media/Agentic%20Language.mp4'
        ),
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

  expect(results.length).toBe(9);
});
