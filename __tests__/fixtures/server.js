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

const { mockApiResponse } = require('../helpers/mockApi');

const PORT = Number(process.env.FIXTURE_PORT) || 5174;
const ROOT = __dirname;

// Rich-text editors (CKEditor, Quill, TinyMCE) are devDependencies; their
// dist bundles are exposed under /vendor/ because the test contexts block all
// non-localhost requests, so a CDN copy could never load.
const VENDOR_ROOT = path.resolve(ROOT, '..', '..', 'node_modules');

// The editor package's build, as published (`npm run build -w
// @witty-works/editor`), for the editor's browser tests under /editor-dist/.
const EDITOR_DIST_ROOT = path.resolve(
  ROOT,
  '..',
  '..',
  'packages',
  'editor',
  'dist'
);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

// The Playwright suite intercepts NLP API calls in the browser. The Firefox
// smoke suite cannot, so it points the extension's custom endpoint here instead
// and gets the same canned responses.
const MOCK_API_PREFIX = '/mock-api/';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const serveMockApi = (req, res, url) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    const response = mockApiResponse(url.pathname, body);
    if (!response) {
      res.writeHead(404, CORS_HEADERS).end('Not found');
      return;
    }
    res
      .writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
      .end(JSON.stringify(response));
  });
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith(MOCK_API_PREFIX)) {
    serveMockApi(req, res, url);
    return;
  }

  const relative = url.pathname === '/' ? '/index.html' : url.pathname;

  // Resolve then confirm the result is still inside its root, so a crafted
  // path cannot escape the fixture (or node_modules) directory.
  const [base, subPath] = relative.startsWith('/vendor/')
    ? [VENDOR_ROOT, relative.slice('/vendor/'.length)]
    : relative.startsWith('/editor-dist/')
      ? [EDITOR_DIST_ROOT, relative.slice('/editor-dist/'.length)]
      : [ROOT, relative.slice(1)];
  const filePath = path.resolve(base, subPath);
  if (!filePath.startsWith(base + path.sep)) {
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
