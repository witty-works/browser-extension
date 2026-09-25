# Witty browser extension and editor

[Witty](https://witty.works) checks writing for inclusive and consistent language. This repository holds two clients of the [Witty NLP API](https://github.com/witty-works/nlp_api), built from one codebase:

- **The browser extension** (Chrome, Firefox, Opera) checks text in the fields of any website: it highlights what Witty flags inside someone else's editor and offers alternatives in a popover.
- **The editor**, [`@witty-works/editor`](packages/editor/README.md) on npm, is a rich-text editor with Witty built in, for embedding in a page with a single script. It reuses the extension's popover, settings, request builders, colours and translations.

Accounts, teams and organisation settings come from the [dashboard](https://github.com/witty-works/dashboard). The NLP API also runs without it, with API keys. The [Microsoft Word add-in](https://github.com/witty-works/word-plugin) is another client.

The extension's code also shows how we dealt with highlighting text within editable fields we don't own, interacting with those highlights, and replacing content with alternatives. [EDITORS.md](EDITORS.md) records what that takes per editor. We would welcome an open-source package that makes this a solved problem across browsers and sites.

## Repository layout

| Path | What |
|---|---|
| `source/` | The extension: `Background/`, `ContentScript/`, `Popup/`, `Options/`, `Notifications/` |
| `source/shared/`, `source/i18n/` | Code both clients use: API requests, the check service, preferences UI, constants, translations (de, en, fr) |
| `packages/editor/` | `@witty-works/editor`: [README](packages/editor/README.md) (usage and API), [FEATURE_GAPS.md](packages/editor/FEATURE_GAPS.md) (what it lacks compared to the extension) |
| `__tests__/` | Browser tests: the extension in Chromium, `firefox/` (smoke suite), `editor/` (the editor bundle), `fixtures/` (pages and server), `helpers/mockApi.js` (the mock NLP API) |
| `build/` | Release version and release config scripts |
| `.github/workflows/` | CI, extension builds, editor publishing |

Background documents: [EDITORS.md](EDITORS.md) (editor support in the extension), [EDITOR_COMPONENT_PLAN.md](EDITOR_COMPONENT_PLAN.md) (the plan behind the editor), [AUTH_SECURITY_PLAN.md](AUTH_SECURITY_PLAN.md) (OAuth and API keys).

## Getting started

You need [Node.js](https://nodejs.org) 20 or later and npm.

```bash
git clone https://github.com/witty-works/browser-extension.git
cd browser-extension
npm install
cp source/witty.config.json.example source/witty.config.json
```

`source/witty.config.json` holds build-time settings for both clients (see [Configuration](#configuration-sourcewittyconfigjson)); it is not committed.

## Scripts

| Script | What |
|---|---|
| `npm run dev:chrome`, `dev:firefox`, `dev:opera` | Build the extension into `extension/<browser>` and rebuild on changes |
| `npm run build:chrome`, `build:firefox`, `build:opera`, `build` | Production builds of the extension |
| `npm run dev:editor` | The editor's demo page, with live reload |
| `npm run lint` | ESLint over the repository |
| `npm run typecheck` | TypeScript for the extension and the editor |
| `npm run test:unit` | The editor's unit tests, with coverage thresholds |
| `npm run test:editor` | Build the editor, check its type declarations from a consumer's side, and run its browser tests |
| `npm test` | Build the extension for testing and run its Chromium suite |
| `npm run test:firefox` | The extension's Firefox smoke suite |
| `npm run test:all` | All of the above checks and tests, as CI runs them |
| `npm run release-version <version>` | Set the version everywhere (see [Versions and releases](#versions-and-releases)) |

## The browser extension

### Development

Start a watching build for your browser: `npm run dev:chrome`, `npm run dev:firefox` or `npm run dev:opera`. It writes to `extension/<browser>` and rebuilds on every save; reload the extension in the browser to pick up the new build.

To load it:

- **Chrome:** open `chrome://extensions`, turn on *Developer mode*, choose *Load unpacked* and select `extension/chrome`.
- **Firefox:** open `about:debugging`, *This Firefox*, *Load Temporary Add-on*, and choose `extension/firefox/manifest.json`.
- **Opera:** open `opera:extensions`, turn on *Developer mode* and load `extension/opera` unpacked.

To work against a local NLP API, clone [nlp_api](https://github.com/witty-works/nlp_api) and start it following its README (for example on `http://localhost:8000`). Then either select the *Local* endpoint in the popup's development settings (`ApiSelector`, stored under `apiEndpoint` in the browser's local storage), or set `X_KEY` in `source/witty.config.json` and rebuild to send a static API key. When troubleshooting, the extension's service worker console shows the `/v2.0/auth` and `/v2.4/check` requests.

`npm run build` builds Firefox and Chrome for production; `npm run build:<browser>` builds one. Versions come from the release scripts, not from editing `manifest.json` by hand; see [Versions and releases](#versions-and-releases).

### Configuration (`source/witty.config.json`)

The extension reads its defaults from `source/witty.config.json` at build time. Settings you may want to change during development or testing:

- `BASE_URLS`: the API, dashboard and PostHog endpoints per environment (Prod, Dev, Local). See [Base URLs](#base-urls-base_urls).
- `X_KEY`: an optional static API key, sent as `x-key` on every request instead of signing in. See [Authentication](#authentication).
- `EXPOSE_WITTY_ID_ALLOW_LIST`: the domains where the extension exposes its `extension-team` / `extension-id` attributes. See [below](#expose-witty-id-allow-list-expose_witty_id_allow_list).
- `MAX_CHAR_LENGTH_REQUEST`: characters per check request, 1000 like the NLP API's default `TEXT_MAX_LENGTH`. Longer texts are checked sentence by sentence in batches of up to this size; if the API cuts a batch short (`limit_reached`), it is sent again in smaller pieces.
- `MAX_CHAR_LENGTH_TOTAL`: characters of a text checked at all; past it the extension shows a notice.

Other keys are written at runtime and only have defaults here:

- `ORTHOGRAPHY`, `DOMAINS`, `ORGANIZATION_DOMAINS`, `USER_ID`, `CONFIG_HASH`, `LLM_ALTERNATIVES` and similar: written when the extension fetches the organisation config; see [source/shared/utils.ts](source/shared/utils.ts).
- `API_DELAY`: set by the delay selector in the popup ([DelaySelector.tsx](source/Popup/PopupComponents/DelaySelector.tsx)).
- `ACCESS_TOKEN` / `REFRESH_TOKEN`: written and cleared by sign-in and sign-out ([source/shared/utils.ts](source/shared/utils.ts), [source/Background/index.tsx](source/Background/index.tsx)).
- `DAILY_POSTHOG_EVENTS_USED`, `LAST_CHECK_EVENT_TIME`: analytics counters ([analyticsUtils.ts](source/shared/ApiServices/analyticsUtils.ts)).

To toggle a feature flag such as `REPHRASE_ENABLED`, edit the file and restart the watching build.

#### Base URLs (`BASE_URLS`)

The extension looks up its API and dashboard URLs in `BASE_URLS` when it starts, so switching between Prod, Dev and Local needs no code change:

```json
"BASE_URLS": {
  "Prod": { "api": "https://api.example.com/", "dashboard": "https://dashboard.example.com/", "posthog_url": "https://app.posthog.com", "posthog_key": "..." },
  "Dev": { "api": "https://dev.api.example.com/", "dashboard": "https://dev.dashboard.example.com/", "posthog_url": "https://app.posthog.com", "posthog_key": "..." },
  "Local": { "api": "http://127.0.0.1:8000/", "dashboard": "https://dashboard.lndo.site/", "posthog_url": "https://app.posthog.com", "posthog_key": "..." }
}
```

[source/shared/constants.ts](source/shared/constants.ts) reads it and falls back to compiled defaults when the key is missing.

#### Expose Witty ID allow list (`EXPOSE_WITTY_ID_ALLOW_LIST`)

The domains where the extension exposes its `extension-team` / `extension-id` attributes, for development. Without the key the attributes are never exposed.

```json
"EXPOSE_WITTY_ID_ALLOW_LIST": {
  "dev": ["lndo.site", "platformsh.site", "witty.works"],
  "prod": ["witty.works"]
}
```

### Authentication

The extension supports two modes:

- **API key (`X_KEY`):** set `X_KEY` in `source/witty.config.json` to send `x-key: <value>` on every request. Convenient for local tests; it skips the token flows and may clear stored tokens.
- **OAuth tokens:** normal sign-in runs OAuth 2.0 Authorization Code with PKCE from the background service worker through `identity.launchWebAuthFlow`, against the dashboard's `/oauth/authorize` and `/oauth/token`. The extension then sends `Authorization: Bearer <access_token>` and refreshes with the `refresh_token` grant. See [AUTH_SECURITY_PLAN.md](AUTH_SECURITY_PLAN.md) for the contract, including the redirect URI to register on the OAuth client.

For local testing only:

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

Never commit `X_KEY`, `ACCESS_TOKEN`, `REFRESH_TOKEN` or any other secret. Production and test builds refuse to run while any of them is set.

### Self-hosting

You can point Witty at your own dashboard and NLP API, at runtime or baked in at build time.

#### Route 1: configure at runtime (no rebuild)

Open the extension's options page: click **Extension settings** in the popup (shown whether or not you are signed in, since you need it *before* you can sign in to a self-hosted server), or go to `chrome://extensions` → Witty → *Extension options*.

Choose **Account** mode and fill in the dashboard URL, NLP API URL and OAuth client ID.

On your dashboard, register the extension's redirect URI on a **public (PKCE) OAuth client**, without a client secret, because an extension bundle cannot keep one. The options page prints the exact URI to register; it is derived from the extension ID and is stable:

| Browser | Redirect URI |
| --- | --- |
| Chrome / Edge / Opera | `https://<extension-id>.chromiumapp.org/` |
| Firefox | `https://<uuid>.extensions.allizom.org/` |

Matching is byte for byte, so a trailing-slash mismatch fails the flow.

#### Route 1b: API key, without a dashboard

If you only need text checking, you can run the NLP API alone. On the options page choose **API key** mode and enter the NLP API URL and your key; it is sent as `x-key`.

The two modes are mutually exclusive: in API-key mode no bearer token is ever sent, and in account mode no `x-key` is. The extension never presents both, which would ask the API to resolve two identities from one request.

This is not the build-time `X_KEY` in `witty.config.json`. That one is a *shared* secret compiled into a bundle everyone installs and can unpack, which is why release builds refuse it. The key entered here is your own, stored in your own browser profile.

What you give up without a dashboard (these features are hidden rather than left to fail):

- domain enable/disable no longer syncs; it stays local to the browser
- "ignore permanently" (ignore once still works)
- the dashboard links in the popup

Category and customisation toggles move to the options page. The category list is whatever the API reports; the section is hidden if it reports none.

#### Route 2: bake your own defaults in (rebuild)

Edit `BASE_URLS` in `source/witty.config.json` and rebuild. Each entry needs `api`, `dashboard` and `oauth_client_id`. This is the right route if you distribute the extension to your own users, since they then get your deployment as the default without configuring anything.

If you distribute your own build, also replace the `key` in `source/manifest.json`: it pins the extension ID, and therefore the redirect URI you must register.

#### Rules the extension enforces

These are deliberate; worth knowing before you file a bug:

- **The endpoint can only be changed from the extension's own options page**, never from a URL parameter, a web page, a content script or a message. An earlier version accepted credentials from `options.html`'s query string while that page was web-accessible, which let *any* website silently repoint the extension. This rule exists to prevent that.
- **Changing the endpoint signs you out.** Tokens are issued by one dashboard and must never be presented to another.
- **`https` is required**, except for `localhost` / `127.0.0.1`, so you can develop against a local dashboard.
- **A custom endpoint never becomes the default.** The shipped default always comes from the compiled `BASE_URLS`.
- **An API key is stored together with the endpoint it was entered for**, and is only ever sent to that endpoint. Pointing the extension elsewhere cannot carry the key across: the binding makes it structurally impossible rather than relying on a cleanup step.

Your dashboard must expose OAuth 2 authorization code with PKCE at `/oauth/authorize` and `/oauth/token`, and should publish `/.well-known/jwks.json` so the NLP API can verify access tokens locally. See [AUTH_SECURITY_PLAN.md](AUTH_SECURITY_PLAN.md) for the full contract.

### Browser-specific manifest keys

`source/manifest.json` can carry keys for particular browsers, prefixed with the vendor:

```js
{
  "__chrome__name": "SuperChrome",
  "__firefox__name": "SuperFox",
  "__edge__name": "SuperEdge",
  "__opera__name": "SuperOpera"
}
```

For `chrome` this compiles to `{"name": "SuperChrome"}`. Separate several vendors with `|`: `"__chrome|opera__name": "SuperBlink"` applies to both. See [wext-manifest-loader](https://github.com/abhijithvijayan/wext-manifest-loader) for details.

## The editor

`@witty-works/editor` lives in [packages/editor](packages/editor), an npm workspace. Its [README](packages/editor/README.md) documents embedding it, its options and handle, the Witty menu, statuses and errors, and the API contract for switching gender formats. [FEATURE_GAPS.md](packages/editor/FEATURE_GAPS.md) lists what the editor does not have yet compared to the extension; items are removed from it as they land.

### Development

`npm run dev:editor` serves the demo page ([packages/editor/index.html](packages/editor/index.html)) with live reload, by default on `http://localhost:5173/`. It checks against `http://localhost:8000/`, a local NLP API; enter an API key in the page's field. Query parameters:

- `?api=<url>` picks another NLP API.
- `?llm=1` offers the AI sentence rewrites in the popover.
- Against the mock API instead of a real one: start `node __tests__/fixtures/server.js` and open `?api=http://localhost:5174/mock-api/`.

`npm run build -w @witty-works/editor` writes what is published: `dist/witty-editor.js` (the script, global `WittyEditor`), `dist/witty-editor.mjs` (the ES module) and `dist/witty-editor.d.ts` (the types), with each bundle's third-party licence notices next to it. The types are generated from [src/api.ts](packages/editor/src/api.ts), the one place the public types are defined; keep it free of imports other than types from `@tiptap/core`, which the build enforces.

### Shared code

The editor reuses the extension's code through path aliases (in `packages/editor/tsconfig.json` and `vite.config.ts`):

| Alias | Points to |
|---|---|
| `@witty/core` | `source/shared` |
| `@witty/i18n` | `source/i18n` |
| `@witty/ui` | `source/ContentScript/HighlightPopover` (the popover) |
| `@witty/assets` | `source/assets` |
| `@witty/test-fixtures` | `__tests__/helpers` (the mock API data, for unit tests) |

A change to shared code reaches both clients, so run both clients' tests (`npm run test:all`). The editor's `editor` translation namespace sits with the extension's in [source/i18n/i18n.translations.ts](source/i18n/i18n.translations.ts); German strings use Swiss spelling (no "ß") and the informal "du".

The editor build reads `source/witty.config.json` like the extension, strips every credential field from it and fails if any remains, so no key can end up in the published bundle.

## Testing

All suites run offline: they serve their own fixture pages and answer every NLP API call from [the mock API](__tests__/helpers/mockApi.js). They need no dashboard, no NLP API and no test account.

| Suite | Command | What |
|---|---|---|
| Editor unit tests | `npm run test:unit` | Vitest with happy-dom over `packages/editor/src`, with coverage thresholds (95% statements, 85% branches, 90% functions, 95% lines) |
| Editor browser tests | `npm run test:editor` | Playwright, headless Chromium: the built script on `__tests__/fixtures/editor.html` and the ES module on `editor-module.html`. Covers what happy-dom cannot, such as opening the popover by clicking a highlight. It first type-checks `packages/editor/types-test/consumer.ts` against the built declarations, as a host project would |
| Extension, Chromium | `npm test` | Playwright with the extension loaded, headed |
| Extension, Firefox | `npm run test:firefox` | A smoke suite in Firefox driven by Puppeteer, headless |

Before the first run, install the browsers: `npx playwright install chromium` and, for Firefox, `npx puppeteer browsers install firefox@stable`. `npm run test:all` runs lint, type checks and every suite.

### CI

[`.github/workflows/ci.yaml`](.github/workflows/ci.yaml) runs on pull requests and on pushes to `dev` and `main`: lint, type checks and the unit tests in one job, followed by a [SonarCloud](https://sonarcloud.io/project/overview?id=witty-works_browser-extension) scan with the unit tests' coverage (skipped for pull requests from forks, which get no token), and each browser suite in its own job. Coverage is only measured for the editor; `sonar-project.properties` excludes the extension's code from it. In CI, Playwright retries a failed test twice, because a few extension tests fail in full-suite runs but pass on their own (see [FEATURE_GAPS.md](packages/editor/FEATURE_GAPS.md)); the report lists them as flaky. Failed runs upload their test results and report.

### How the extension suites stay standalone

- **Fixture pages** (`__tests__/fixtures/`) are plain HTML with a textarea, a contenteditable or a third-party editor, served by a dependency-free static server that Playwright starts and stops. They must be served over `http://` rather than opened as `file://`, because the content scripts only match `http://*` and `https://*`.
- **The NLP API is mocked.** `/v2.0/auth`, `/v2.4/check` and `/v1.0/rephrase` are answered from canned fixtures matched on pathname, so the mocks keep working whichever `BASE_URLS` entry the build points at. Any request that escapes the mocks is aborted and logged: reaching the internet is treated as a harness bug. The Firefox suite and the editor tests use the same responses from the fixture server under `/mock-api/`.
- **Sign-in is seeded, not performed.** Helpers write a fixture token straight into `chrome.storage.local`. Driving a real OAuth flow would reintroduce the dependency on a live dashboard and a shared account.
- **The extension ID** comes from the background service worker's URL, not from loading `witty.works` and reading an injected attribute.

Notes:

- `npm test` builds with `TESTING=true`, which suppresses the on-install OAuth flow. Without it, `launchWebAuthFlow` opens an auth window that never resolves and sits in front of every screenshot.
- Test builds use `NODE_ENV=production`, so the build refuses to run while `X_KEY`, `ACCESS_TOKEN` or `REFRESH_TOKEN` are set in `witty.config.json`. Clear them to run the suite; an API key would also bypass the sign-in states the tests assert on.
- Extensions need a headed browser and a persistent context, so the Chromium suite runs headed with a single worker (under `xvfb-run` in CI).
- `npm run test:ui` opens Playwright's interactive UI mode.

### Live OAuth test (opt-in)

`__tests__/auth.e2e.spec.js` drives a real sign-in against a running dashboard. It is **not** standalone and is skipped unless credentials are supplied, so the default suite stays offline:

```bash
E2E_DASHBOARD=https://dashboard.lndo.site/ \
E2E_EMAIL=someone@example.com \
E2E_PASSWORD=secret \
npx playwright test __tests__/auth.e2e.spec.js
```

It requires a dashboard with the extension's PKCE client provisioned, the redirect URI registered byte for byte (`https://<extension-id>.chromiumapp.org/`), and `oauth_client_id` set on the matching `BASE_URLS` entry in `witty.config.json`.

Besides completing the flow, it asserts the storage split: the access token must be absent from `storage.local` and present in `storage.session`, while the refresh token persists on disk.

### Updating screenshots

Highlight placement is asserted with screenshots in `__tests__/highlights.spec.js-snapshots/`. They are platform-suffixed (`-darwin`, `-linux`), so regenerate them on the platform CI uses:

```bash
npm run test:update-snapshots
```

Review the diff before committing: a changed snapshot is either a fix or a regression, and the file alone does not say which.

### Manual checks for the extension

The automated suites don't cover everything the extension does across real sites. After changing these areas, check by hand:

**Highlights** (textarea and contenteditable):

- Highlights scroll correctly within a scrolling text area, and stay fixed when the surrounding window scrolls.
- Highlights keep their position; those above an edit stay put while those below are removed and re-added in the right place.
- Long texts: only the first `MAX_CHAR_LENGTH_TOTAL` characters are checked; more can be highlighted by clicking a paragraph.
- Google Docs compatibility code is largely separate and needs the same updates.
- No highlights are shown, and no text is sent to the API, when the user is not signed in.
- Highlights adapt when the field or the whole window is resized.

**Popover:**

- It opens and closes correctly when clicking a word, next to the word.
- The right popover is shown for the user's state (signed out, signed in).
- Learning bites load.
- Alternatives are inserted correctly, especially "remove" alternatives.
- Ignoring a word once, and permanently through the dashboard, works.

**Popup:**

- Enabling and disabling the extension works: when disabled, neither the active nor the passive Witty icon appears anywhere, and there are no `ww-container` elements in the DOM. Pay extra attention to iframes and pages with several input fields.
- The right popup is shown for the situation (signed out, domain disabled, signed in).

### Common compatibility issues

- **Highlights do not appear:** check `getZIndex` in `Highlights.tsx` for z-index or stacking-context problems.
- **Witty does not load:** check the target element detected in `handleFocusinElement` in `ContentScriptApp.tsx`; it may pick a parent, child or unrelated element.
- **Highlights displaced:** usually `canvasSize`, `correctedPosition` or `rangeRects` in `Highlights.tsx`. For Google Docs and textareas, check the styling in `GoogleDocsClone.tsx` and `TextAreaClone.tsx`.
- **Scrolling displaces highlights:** usually `correctedPosition.top` in `canvasSize`, or `elementScroll` in `Input.tsx`.
- **Alternatives cannot be inserted:** try the other methods in `updateTextWithAlternative` in `Input.tsx`.
- **Enabling or disabling Witty does not work:** often how the domain is stored or read, especially for iframe domains.
- **CSS conflicts:** make sure CSS classes are namespaced.

## Versions and releases

The extension and the editor share one version, set in `package.json`, `packages/editor/package.json`, the lockfile and `source/manifest.json` by:

```bash
npm run release-version 2.4.0          # a release
npm run release-version 2.4.0-beta.1   # a beta
```

A release, step by step:

1. On a branch from `dev`, run `npm run release-version <version>`, commit, and open a pull request into `dev`.
2. When CI is green, merge it, and push a tag with the same name on the merge commit in `dev`.
3. The tag's workflows build and publish (below). Approve the staged editor release on npmjs.com (or with `npm stage approve <id>`), and upload the extension packages from the workflow's artifacts to the stores.
4. For a release (not a beta), the workflow opens a pull request "Release <version>" from `release/<version>` into `main`. Approve it and merge it with a merge commit: `main` always holds the latest release. It requires a reviewed pull request, so this is the one step CI cannot do on its own.

| Tag | Extension | Editor on npm |
|---|---|---|
| `2.4.0` | [prod_tag.yaml](.github/workflows/prod_tag.yaml) builds the Chrome and Firefox packages and a source archive as workflow artifacts, for the store listings, and opens the pull request into `main` | [publish-editor.yaml](.github/workflows/publish-editor.yaml) stages `2.4.0` with provenance, dist-tag `latest` |
| `2.4.0-beta.1` | [dev_tag.yaml](.github/workflows/dev_tag.yaml) builds the Chrome package for the dev listing, with manifest version `2.4.0.1` and `version_name` `2.4.0-beta.1` | Staged as `2.4.0-beta.1`, dist-tag `beta` |

Both workflows first check that the tag's commit is on `dev` or `main`, and that the tag matches the version in the repository; a tag anywhere else builds and publishes nothing. All workflows run on Node 22, pin their actions to commit SHAs, and run with read-only repository access, except where they need more: the editor's publishing gets an OIDC token for npm, and the job opening the pull request into `main` may push its branch and open the pull request. The editor is published through npm trusted publishing, without a token: the workflow can only stage a version, and a maintainer approves it before it is public. Every push also builds a development Chrome package ([branch.yaml](.github/workflows/branch.yaml)).

**Sentry.** The release builds upload their source maps to a Sentry release named after the tag, channel and browser, e.g. `2.4.0-prod-chrome` or `2.4.0-beta.1-dev-chrome`, and the extension built there reports its errors under that same release, so Sentry shows them against the source. The build keeps the repository history, so the release gets its commits (Sentry's suspect commits), provided Sentry's GitHub integration is set up for the organisation; the source archive leaves the history out. Local and test builds report the manifest version and upload nothing.

## Linting and TypeScript

ESLint and Prettier follow [`@abhijithvijayan/eslint-config`](https://www.npmjs.com/package/@abhijithvijayan/eslint-config), TypeScript [`@abhijithvijayan/tsconfig`](https://www.npmjs.com/package/@abhijithvijayan/tsconfig). ESLint enforces the editor package's formatting, which has no spaces inside braces; to format those files by hand, run `npx prettier --no-bracket-spacing --write <files>`.

## License

MIT, see [LICENSE](LICENSE). The extension started as a fork of [Web Extension Starter](https://github.com/abhijithvijayan/web-extension-starter/) by [Abhijith Vijayan](https://abhijithvijayan.in), also MIT. The editor's bundle includes third-party software; its licence notices ship in `dist/witty-editor.js.LICENSE.txt`.
