# Witty Browser Extension

This code is for now just released as is without a functional backend to make it work practically.

The main intention of releasing it in its current form is to allow developers who are looking to build similar browser extensions to look at how we dealt with the challenges of:

- highlighting text within editable fields
- allowing interaction with the highlights to receive context information
- replacing content through proposed alternatives.

Our ideal hope would be the creation of an open source package that will make this type of use case a "solved problem" across all browsers by pooling resources to maintain reliable algorithms for dealing with all websites out there, or at least a sizeable subset.

This code was created at https://witty.works that formed our solution for "operationalizing" inclusive language and consistent language within organizations. This is essentially a client UI for the https://github.com/witty-works/nlp_api and integrates with https://github.com/witty-works/dashboard for authentication. The Microsoft Word Add-in https://github.com/witty-works/word-plugin is an alternative client UI

## Requirements to start

- [Node.js](https://nodejs.org) 18+
- [npm](https://www.npmjs.com/)

# Get the code

Clone repo `git clone https://github.com/witty-works/browser-extension.git`

## Preparing the project

Go to project directory `cd browser-extension`

Ensure you are using node 18+

Run `npm install` to install dependencies.

Before running or building the extension, copy the example config and customize it for your environment:

```bash
cp source/witty.config.json.example source/witty.config.json
# then edit source/witty.config.json to set `api.endpoint`, feature flags etc.
```

## Development

From inside the directory, start the development server depending on the browser you are using

- Chrome: `npm run dev:chrome`
- Firefox: `npm run dev:firefox`
- Opera: `npm run dev:opera`

This will run in the background, watching for changes and rebuilding the project automatically.

## Building for production

You can several options:

- `npm run build:chrome` to build chrome extension
- `npm run build:firefox` to build firefox addon
- `npm run build:opera` to build opera extension
- `npm run build` builds and packs extensions all at once to `extension/BROWSER` directory respectively.

**Note:** By default the `manifest.json` is set with version `0.0.0`. The webpack loader will update the version in the build with that of the `package.json` version. In order to release a new version, update version in `package.json` and run script.

If you don't want to use `package.json` version, you can disable the option [here](https://github.com/abhijithvijayan/web-extension-starter/blob/e10158c4a49948dea9fdca06592876d9ca04e028/webpack.config.js#L79).

## Configuration settings (`source/witty.config.json`)

The extension reads runtime defaults from `source/witty.config.json`. Key settings you may want to tune during local development or testing:

- `ORTHOGRAPHY`: written when the app fetches organization config from the server — see [source/shared/utils.ts](source/shared/utils.ts#L360-L386).
- `API_DELAY`: user-changeable via the popup Delay selector (writes to storage). See [source/Popup/PopupComponents/DelaySelector.tsx](source/Popup/PopupComponents/DelaySelector.tsx#L26).
- `ACCESS_TOKEN` / `REFRESH_TOKEN`: written/cleared by auth flows and logout. See [source/shared/utils.ts](source/shared/utils.ts#L320-L340) and [source/Background/index.tsx](source/Background/index.tsx#L347-L348).
- Telemetry counters: `DAILY_POSTHOG_EVENTS_USED` and `LAST_CHECK_EVENT_TIME` are updated at runtime by analytics code. See [source/shared/ApiServices/analyticsUtils.ts](source/shared/ApiServices/analyticsUtils.ts#L31-L40).
- Other server-populated keys (written at runtime): `DOMAINS`, `ORGANIZATION_DOMAINS`, `USER_ID`, `CONFIG_HASH`, `LLM_ALTERNATIVES`, etc. See [source/shared/utils.ts](source/shared/utils.ts#L360-L386).

- `X_KEY`: optional static API key — when set the extension will attach `x-key: <value>` to outbound API requests and skip token/refresh flows; see the `X_KEY` section below for example and security notes.

- `BASE_URLS`: object — choose which set of API/dashboard/PostHog endpoints the extension uses (Prod/Dev/Local). See the "Base URLs configuration (BASE_URLS)" section below for structure and examples.
- `EXPOSE_WITTY_ID_ALLOW_LIST`: object — domains where the extension exposes its `extension-team`/`extension-id` attributes for development. See the "Expose Witty ID allow list (EXPOSE_WITTY_ID_ALLOW_LIST)" section below for structure and examples.

**Authentication**

The extension supports two modes:

- API key (`X_KEY`): add `X_KEY` to `source/witty.config.json` to send `x-key: <value>` on requests. This is convenient for simple tests or CI; it bypasses token refresh and may purge stored `ACCESS_TOKEN`/`REFRESH_TOKEN`.

- OAuth tokens (`ACCESS_TOKEN` / `REFRESH_TOKEN`): normal sign-in runs OAuth 2.0 Authorization Code + PKCE from the background service worker via `identity.launchWebAuthFlow`, against the dashboard's `/oauth/authorize` and `/oauth/token`. When present the extension sends `Authorization: Bearer <access_token>` and refreshes via the `refresh_token` grant. See AUTH_SECURITY_PLAN.md for the full contract, including the redirect URI to register on the OAuth client.

Security note: never commit production `X_KEY`, `ACCESS_TOKEN`, or `REFRESH_TOKEN`; prefer environment-backed secrets.

Example snippets (local testing only):

```json
{ "X_KEY": "your-api-key-here" }
```

or

```json
{
  "ACCESS_TOKEN": "your-static-access-token",
  "REFRESH_TOKEN": "your-static-refresh-token"
}
```

**Base URLs configuration (`BASE_URLS`)**

The extension looks up API and dashboard base URLs from the `BASE_URLS` config object when it boots. This allows switching the target API (Prod/Dev/Local) at build time without changing source code.

Structure (in `source/witty.config.json`):

```json
"BASE_URLS": {
  "Prod": { "api": "https://api.example.com/", "dashboard": "https://dashboard.example.com/", "posthog_url": "https://app.posthog.com", "posthog_key": "..." },
  "Dev": { "api": "https://dev.api.example.com/", "dashboard": "https://dev.dashboard.example.com/", "posthog_url": "https://app.posthog.com", "posthog_key": "..." },
  "Local": { "api": "http://127.0.0.1:8000/", "dashboard": "https://dashboard.lndo.site/", "posthog_url": "https://app.posthog.com", "posthog_key": "..." }
}
```

`source/shared/constants.ts` reads `defaultConfig.BASE_URLS` (the uppercase `BASE_URLS` key) and falls back to compiled defaults if the key is missing. See [source/shared/constants.ts](source/shared/constants.ts) for implementation.

**Expose Witty ID allow list (`EXPOSE_WITTY_ID_ALLOW_LIST`)**

Use this config to control which domains the extension exposes its `extension-team`/`extension-id` attributes for development purposes. The key is expected to be present at build time (in `source/witty.config.json`) and is read by `source/shared/constants.ts`. If the key is missing, the code will not expose the attributes.

Structure example:

```json
"EXPOSE_WITTY_ID_ALLOW_LIST": {
  "dev": ["lndo.site", "platformsh.site", "witty.works"],
  "prod": ["witty.works"]
}
```

Notes:

- Use `X_KEY` for simple test setups or CI where a single static key is acceptable; prefer running the local NLP API and selecting its endpoint via the Popup `ApiSelector` for iteration.
- Never commit production `X_KEY`, `ACCESS_TOKEN`, or any secret to source control. Use environment-backed secrets or local `.env` files for CI/test fixtures.
- To quickly toggle features like `REPHRASE_ENABLED`, edit `source/witty.config.json` and restart the dev build (`npm run dev:chrome` or rebuild).

## Self-hosting

You can point Witty at your own dashboard and NLP API. Two routes — runtime, or
baked in at build time.

### Route 1: configure at runtime (no rebuild)

Open the extension's options page — click **Extension settings** in the popup
(shown whether or not you are signed in, since you need it *before* you can sign
in to a self-hosted server). It is also reachable via `chrome://extensions` →
Witty → *Extension options*.

Choose **Account** mode and fill in the dashboard URL, NLP API URL and OAuth
client ID.

On your dashboard, register the extension's redirect URI on a **public
(PKCE) OAuth client** — no client secret, because an extension bundle cannot
keep one. The options page prints the exact URI to register; it is derived from
the extension ID and is stable:

| Browser | Redirect URI |
| --- | --- |
| Chrome / Edge / Opera | `https://<extension-id>.chromiumapp.org/` |
| Firefox | `https://<uuid>.extensions.allizom.org/` |

Matching is byte-for-byte, so a trailing-slash mismatch will fail the flow.

### Route 1b: API key — run without a dashboard

If you only need text checking, you can run the NLP API alone and skip the
dashboard entirely. On the options page choose **API key** mode and supply the
NLP API URL plus your key; it is sent as `x-key`.

The two modes are mutually exclusive: in API-key mode no bearer token is ever
sent, and in account mode no `x-key` is. The extension never presents both,
which would ask the API to resolve two identities from one request.

This is not the same thing as the build-time `X_KEY` in `witty.config.json`.
That one is a *shared* secret compiled into a bundle everyone installs and can
unpack, which is why release builds refuse it. The key entered here is your own,
stored in your own browser profile.

What you give up without a dashboard — these features are hidden rather than
left to fail:

- domain enable/disable no longer syncs (it stays local to the browser)
- "ignore permanently" (ignore-once still works)
- the dashboard links in the popup header and body

Category and customisation toggles live on the options page instead. The
category list is whatever the API reports; the section is hidden if it reports
none.

### Route 2: bake your own defaults in (rebuild)

Edit `BASE_URLS` in `source/witty.config.json` and rebuild. Each entry needs
`api`, `dashboard` and `oauth_client_id`. This is the right route if you are
distributing the extension to your own users, since they then get your
deployment as the default rather than having to configure anything.

If you distribute your own build, also replace the `key` in
`source/manifest.json` — it pins the extension ID, and therefore the redirect
URI you must register.

### Rules the extension enforces

These are deliberate and worth knowing before you file a bug:

- **The endpoint can only be changed from the extension's own options page.**
  Never from a URL parameter, a web page, a content script or a message. An
  earlier version accepted credentials from `options.html`'s query string while
  that page was web-accessible, which let *any* website silently repoint the
  extension. That is the vulnerability this rule exists to prevent.
- **Changing the endpoint signs you out.** Tokens are issued by one dashboard
  and must never be presented to another.
- **`https` is required**, except for `localhost` / `127.0.0.1` so you can
  develop against a local dashboard.
- **A custom endpoint never becomes the default.** The shipped default always
  comes from the compiled `BASE_URLS`.
- **An API key is stored together with the endpoint it was entered for**, and is
  only ever sent to that endpoint. Pointing the extension elsewhere cannot carry
  the key across — the binding makes it structurally impossible rather than
  relying on a cleanup step.

Your dashboard must expose OAuth2 authorization-code + PKCE at
`/oauth/authorize` and `/oauth/token`, and should publish
`/.well-known/jwks.json` so the NLP API can verify access tokens locally. See
`AUTH_SECURITY_PLAN.md` for the full contract.

## Load the extension in the browser

Either you run the Development or Production scripts, it is build inside `extension/BROWSER` folder. Just follow the different instructions depending on the browser

### Chrome

- Go to the browser address bar and type `chrome://extensions`
- Check the `Developer Mode` button to enable it.
- Click on the `Load Unpacked Extension…` button.
- Select your extension’s extracted directory.

## Local development — Chrome (quick guide)

This section explains how to run the extension locally during development and connect it to a locally-running NLP API backend.

- Prerequisites: Node.js 18+, npm, and a local copy of the NLP API (see below).
- Install dependencies:

```bash
npm install
```

- Start the dev build for Chrome (webpack will watch and rebuild on changes):

```bash
npm run dev:chrome
```

- Open Chrome and go to `chrome://extensions` → enable `Developer mode` → `Load unpacked` and point to the build output directory. The development build is emitted into the extension folder for the chosen browser, e.g. `extension/chrome` (or `extension/BROWSER` if you use a different target).

- Configure the NLP API backend:

  - Option A (recommended for fast iteration): run the NLP API locally and select the `Local` API endpoint in the extension popup's Development Settings (`ApiSelector`). The extension stores your choice in browser local storage under the `apiEndpoint` key and will use the selected base URL for requests.
  - Option B (static API key): if you prefer using a static API key, set `X_KEY` in `source/witty.config.json` and rebuild (`npm run build:chrome` or `npm run dev:chrome`). This will attach the `x-key: <value>` header to requests.

- Running a local NLP API server: clone the NLP API repository referenced in this project (https://github.com/witty-works/nlp_api) and follow its README to start the server locally. Note the server base URL (for example `http://localhost:8000`) and select the matching API endpoint in the extension popup.

- Useful tips:
  - When using `npm run dev:chrome`, webpack writes updated bundles on each save; reload the extension in `chrome://extensions` (or enable extension auto-reload tooling) to pick up the latest build.
  - To test API-key mode without rebuilding, you can temporarily update the `apiEndpoint` via the popup `ApiSelector` and use an endpoint that accepts a test key; however `X_KEY` in `witty.config.json` requires rebuilding to take effect.
  - Check the browser console & background logs (via the extension's service worker or background page) for `/v2.0/auth` and `/v2.4/check` requests when troubleshooting connectivity.

If you need a sample `X_KEY` for local testing, add it to `source/witty.config.json` as shown in the `X_KEY` section above — but never commit production keys to source control.

### Firefox

- Load the Add-on via `about:debugging` as temporary Add-on.
- Choose the `manifest.json` file in the extracted directory

### Opera

- Load the extension via `opera:extensions`
- Check the `Developer Mode` and load as unpacked from extension’s extracted directory.

## Generating browser specific manifest.json

Update `source/manifest.json` file with browser vendor prefixed manifest keys

```js
{
  "__chrome__name": "SuperChrome",
  "__firefox__name": "SuperFox",
  "__edge__name": "SuperEdge",
  "__opera__name": "SuperOpera"
}
```

if the vendor is `chrome` this compiles to:

```js
{
  "name": "SuperChrome",
}
```

---

Add keys to multiple vendors by separating them with | in the prefix

```
{
  __chrome|opera__name: "SuperBlink"
}
```

if the vendor is `chrome` or `opera`, this compiles to:

```
{
  "name": "SuperBlink"
}
```

See the original [README](https://github.com/abhijithvijayan/wext-manifest-loader) of `wext-manifest-loader` package for more details

## Testing

The Playwright suite is **self-contained**: it serves its own fixture pages and
mocks every NLP API call, so it needs no deployed dashboard, no running NLP API,
and no test account. It runs offline.

```bash
npx playwright install chromium   # once
npm run test
```

`npm run test` builds the extension with `TESTING=true` first, then runs
Playwright. Other entry points:

- `npm run test:ui` — Playwright's interactive UI mode
- `npm run test:update-snapshots` — re-record the screenshot baselines

### How it stays standalone

- **Fixture pages** (`__tests__/fixtures/`) are plain HTML with a textarea or a
  contenteditable, served by a dependency-free static server that Playwright
  starts and stops. They must be served over `http://` rather than opened as
  `file://`, because the content scripts only match `http://*` and `https://*`.
- **The NLP API is mocked** (`__tests__/helpers/mockApi.js`). `/v2.0/auth`,
  `/v2.4/check` and `/v1.0/rephrase` are answered from canned fixtures matched on
  pathname, so the mocks keep working whichever `BASE_URLS` entry the build
  points at. Any request that escapes the mocks is aborted and logged — reaching
  the internet is treated as a harness bug.
- **Sign-in is seeded, not performed.** Helpers write a fixture token straight
  into `chrome.storage.local`. Driving a real OAuth flow would reintroduce the
  dependency on a live dashboard and a shared account.
- **The extension ID** comes from the background service worker's URL, not from
  loading `witty.works` and reading an injected attribute.

### Notes

- `TESTING=true` suppresses the on-install OAuth flow. Without it,
  `launchWebAuthFlow` opens an auth window that never resolves and sits in front
  of every screenshot.
- Test builds use `NODE_ENV=production`, so the build refuses to run while
  `X_KEY`, `ACCESS_TOKEN` or `REFRESH_TOKEN` are set in `witty.config.json`.
  Clear them to run the suite — an API key would bypass the sign-in states the
  tests assert on.
- Extensions require a headed browser and a persistent context, so the suite
  runs headed with a single worker.

### Live OAuth test (opt-in)

`__tests__/auth.e2e.spec.js` drives a real sign-in against a running dashboard.
It is **not** standalone and is skipped unless credentials are supplied, so the
default suite stays offline:

```bash
E2E_DASHBOARD=https://dashboard.lndo.site/ \
E2E_EMAIL=someone@example.com \
E2E_PASSWORD=secret \
npx playwright test __tests__/auth.e2e.spec.js
```

It requires a dashboard with the extension's PKCE client provisioned, the
redirect URI registered byte-for-byte
(`https://<extension-id>.chromiumapp.org/`), and `oauth_client_id` set on the
matching `BASE_URLS` entry in `witty.config.json`.

Besides completing the flow, it asserts the storage split: the access token must
be absent from `storage.local` and present in `storage.session`, while the
refresh token persists on disk.

### Updating screenshots

Highlight placement is asserted with screenshot snapshots in
`__tests__/highlights.spec.js-snapshots/`. They are platform-suffixed
(`-darwin`, `-linux`), so regenerate them on the platform CI uses:

```bash
npm run test:update-snapshots
```

Review the diff before committing — a changed snapshot is either a fix or a
regression, and the file alone does not say which.

## Linting & TypeScript Config

- Shared Eslint & Prettier Configuration - [`@abhijithvijayan/eslint-config`](https://www.npmjs.com/package/@abhijithvijayan/eslint-config)
- Shared TypeScript Configuration - [`@abhijithvijayan/tsconfig`](https://www.npmjs.com/package/@abhijithvijayan/tsconfig)

## License

This is a fork of [Web Extension Browser](https://github.com/abhijithvijayan/web-extension-starter/) by [Abhijith Vijayan](https://abhijithvijayan.in) under MIT license.

## Testing Guidelines for Frequent Functionalities (Applicable to Textarea and Contenteditable)

### Testing Highlight Functionality

After making changes to highlights:

- Ensure highlights scroll correctly within the scrolling text area.
- Verify highlights stay fixed when scrolling the surrounding window.
- Check that highlights maintain their position.
- Ensure highlights above text remain fixed while the highlights below are removed and then re-added in the correct position.
- For long text, ensure only the first set number of characters are sent to the API. Users should be able to highlight additional text by clicking on a paragraph.
- Note that much of the Google Docs compatibility code is separate and also needs updates.
- Confirm that no highlights are displayed — and no text is sent to the API — when the user is not logged in.
- Verify that highlights adapt when resizing the input window as well as when resizing the entire window.

### Testing Popover Functionality

After making changes to popover:

- Ensure the popover opens and closes correctly when clicking a word.
- Verify the correct popover is displayed based on user status (not logged in, logged in).
- Check that the position of the popover is accurate relative to the selected word.
- Confirm that learning bites are loaded correctly.
- Verify that alternatives are inserted correctly, with specific attention to 'remove' alternatives.
- Test the functionality of ignoring a word once and ignoring a word permanently through dashboards.

### Testing Popup Functionality

After making changes to popup:

- Verify enabling and disabling the extension functions correctly:
  - Ensure that when the extension is disabled, neither the 'witty active' nor 'witty passive' icons appear anywhere.
  - Confirm no 'ww-container' elements are in the DOM.
  - Pay extra attention to the behavior with iframes and when multiple input fields are on a page.
- Ensure the correct popup is shown in appropriate situations (not logged in, domain disabled, logged in).

## Common Compatibility Issues and Resolutions

### Highlight Visibility Issues

- **Highlights Do Not Appear**: Check `getZIndex` in `Highlights.tsx` for issues related to z-index or stacking contexts.
- **Witty Does Not Load**: Investigate the target element detected in `handleFocusinElement` in `ContentScriptApp.tsx`. The issue may involve incorrect targeting of parent, child, or unrelated elements.
- **Highlights Displaced**: Commonly related to `canvasSize`, `correctedPosition`, or `rangeRects` positions in `Highlights.tsx`.
- **Google Docs and Text Area Displaced Highlights**: Ensure correct styling is applied in `GoogleDocsClone.tsx` and `TextAreaClone.tsx`.

### Scrolling and Insertion Issues

- **Scrolling Displaces Highlights**: Typically involves issues with `correctedPosition.top` in the `canvasSize` or `elementScroll` in `Input.tsx`.
- **Alternatives Cannot Be Inserted**: Explore different methods provided in `updateTextWithAlternative` in `Input.tsx`.

### Functionality and Styling Issues

- **Enabling/Disabling Witty Not Functioning**: Often a problem with how the domain is stored or accessed, especially within iframe domains.
- **CSS Conflicts**: Ensure that CSS classes are properly namespaced to avoid conflicts.
