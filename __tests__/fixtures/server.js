/**
 * Minimal static file server for the test fixture pages.
 *
 * Deliberately dependency-free (node:http + node:fs only) so running the test
 * suite does not pull in a server package. Playwright starts and stops this via
 * the `webServer` block in playwright.config.js.
 *
 * The fixtures must be served over http:// rather than opened as file://
 * because the extension's content scripts only match `http://*` and `https://*`
 * — a file:// page would never get the content script injected, so nothing
 * would be under test.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.FIXTURE_PORT) || 5174;
const ROOT = __dirname;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const relative = url.pathname === '/' ? '/index.html' : url.pathname;

  // Resolve then confirm the result is still inside ROOT, so a crafted path
  // cannot escape the fixture directory.
  const filePath = path.resolve(ROOT, `.${relative}`);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, body) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type':
        CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream',
      // Fixtures change between runs; never let the browser reuse an old copy.
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  // Playwright waits for this port to accept connections.
  console.log(`fixture server listening on http://localhost:${PORT}`);
});
