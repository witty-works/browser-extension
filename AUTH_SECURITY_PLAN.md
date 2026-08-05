# Authentication hardening plan

Status: extension and dashboard complete; NLP API in progress — 2026-08-04

Spans three repositories:

| Repo | Path | Role |
| --- | --- | --- |
| `browser-extension` | `~/htdocs/browser-extension` | Client UI, holds tokens |
| `dashboard` | `~/htdocs/dashboard` | Laravel — identity provider, issues tokens |
| `nlp_api` | `~/htdocs/nlp_api-flexible` | FastAPI — validates tokens, serves `/check` |

---

## 1. Current state: the auth chain is broken end-to-end

This is not "harden a working flow" — it is "design the replacement". Three
independent breaks, all introduced when Azure AD B2C was removed
(`dashboard@d4e2f683`):

1. **Dashboard returns the wrong shape.**
   `OAuthController::browserLogin()` (`app/Http/Controllers/OAuthController.php:210-233`)
   returns JSON `{token, email, name, id}`. The extension expects a **302 back to
   `redirect_uri`** carrying `access_token` / `refresh_token` query params
   (`source/Popup/Popups/PopupLogin.tsx:76` → `source/Options/Options.tsx:17-18`).
   The `redirect_uri` and `register` params are ignored entirely; the old
   `validateRedirectUri` / `checkAllowedRedirectUri` helpers were deleted along
   with Azure.

2. **The refresh endpoint points at a method that no longer exists.**
   `routes/api.php:23` routes `/api/refresh-token` to
   `OAuthController::accessTokenFromRefreshToken`, which was deleted. There is no
   refresh token in the new design at all — just a 1-hour JWT.

3. **The extension cannot authenticate against the dashboard's own `/api/user/*`
   routes either.** `UserGuidelinesApiController::getUser()`
   (`app/Http/Controllers/UserGuidelinesApiController.php:189-217`) only accepts
   a bearer token whose `aud` matches `services.microsoft_office.client_id` —
   i.e. Microsoft Office SSO tokens — and `abort(403)`s otherwise. So the
   extension's domain and ignore-word management is dead too. This fails closed,
   so it is a breakage rather than a vulnerability, but Phase 1 must give these
   routes a real guard.

4. **The NLP API rejects the new token regardless of the above.**
   `app/auth_service.py:305-310` dispatches on
   `unverified_claims["aud"] == config["client_id"]` and then performs a
   JWKS/B2C decode. The Laravel token carries no `aud` and is HS256, so the loop
   never matches and the request falls through to
   `403 "Token provided did not map to a valid client ID"`. There is no code path
   for a Laravel-issued token.

Upside: there are no migration constraints. We can design it correctly.

## 2. Live security issues in the extension

- **Anyone can inject tokens into the extension.** `options.html` is listed in
  `web_accessible_resources` with `"matches": ["<all_urls>"]`
  (`source/manifest.json:91-102`) and `source/Options/Options.tsx` accepts
  `access_token` / `refresh_token` straight off the query string with **zero
  origin or state validation**. `manifest.json:4` pins a fixed `key`, so the
  extension ID is public and stable. Any website can therefore navigate to
  `chrome-extension://<id>/options.html?access_token=…&refresh_token=…` and
  silently swap the victim's session onto an attacker-controlled account.
  Everything the user subsequently types into any text field on any site is then
  sent to the attacker's tenant.
- **Open redirect** from a `chrome-extension://` origin: `target` is read
  unvalidated from the query string and passed to `window.open`
  (`source/Options/Options.tsx:19-31`).
- **Tokens travel in a URL query string** — recorded in history, referrers, logs.
- **`DEV_ENV = true` is hardcoded** (`source/shared/constants.ts:7`) and nothing
  in `webpack.config.js` rewrites it. Every production build therefore ships dev
  behaviour: `ApiSelector` visible in the popup, dev-tier
  `exposeWittyIdAllowList`, `setInLocalStorage` unconditionally overwriting
  stored values. `DefaultBaseUrlKey = 'Local'` (`constants.ts:75`) means release
  builds default to `http://127.0.0.1:8000/`.
- **`X_KEY` bakes a shared secret into a distributable bundle**
  (`source/shared/ApiServices/requests.ts:53-56`). Acceptable for CI, dangerous
  as anything a user installs.
- **`logOut()` only clears local storage** (`source/shared/utils.ts:173-182`) —
  the refresh token remains valid server-side indefinitely.
- **Tokens are stored in `browser.storage.local`** — plaintext on disk, with no
  `exp` awareness; refresh is purely reactive to a 401.

## 3. Live security issues in the dashboard

- **`browserLogin` signs with `config('app.key')`** — Laravel's master secret,
  also used for cookie/session encryption and `Crypt::`. Handing signing
  capability to the Python API means sharing that key.
- **No `aud`, `jti`, or `nbf`** in the issued JWT; 1-hour expiry with no refresh
  path, so users would re-authenticate hourly.
- **No rate limiting** on the token or refresh routes.
- **Unauthenticated users get a raw JSON 401** instead of being redirected to the
  login page, so the extension's "Sign in" button dead-ends.

---

## 4. Design decision: how much endpoint flexibility to allow

Self-hosters must be able to point the extension at their own dashboard and NLP
API.

**Revised 2026-08-04 after reviewing the LanguageTool Enterprise model.** An
earlier draft of this plan required self-hosters to produce their own build and
forbade runtime endpoint configuration outright. That was too strict, and the
LanguageTool precedent shows why:

- LanguageTool ships a **runtime custom-server setting** in its store-published
  browser add-on. So "runtime-configurable endpoint" is the industry norm for
  this product category and is evidently not a store-review blocker per se.
- Their self-hosted server, per the Enterprise install guide, runs with no
  authentication at all (`--public`, `--allow-origin "*"`, protected by IP
  restrictions and a reverse proxy). Account/premium auth is a **separate axis**
  from the custom-server setting. So pointing the add-on at your own server
  moves *text*, but there are no credentials to steal and no session to hijack.

That difference is the whole point. Our dashboard issues OAuth tokens, so the
question is not "may the endpoint be configurable" but "what must be true when
it changes". The real invariant is about **how** the endpoint can be set, not
**whether**:

1. **The endpoint may only change through deliberate user action in the
   extension's own UI.** Never from a URL parameter, a web page, a content
   script, or a `postMessage`. This is exactly what was broken: `options.html`
   was web-accessible and took `access_token` straight off the query string, so
   *any website* could repoint the extension silently. That is the actual
   vulnerability, and it is fixed in Phase 0 — independent of this decision.
2. **Changing the endpoint must clear all credentials.** Tokens are issued by
   one dashboard and must never be presented to another. (Implemented in Phase 0;
   the previous `ApiSelector` only logged out when switching to `'Prod'`, and
   compared against a typo'd `' Prod'`.)
3. **Shipped defaults stay pinned** to the official deployment, and release
   builds must never default to a developer's localhost. (Phase 0.)
4. **The user is warned** at the point of change about what they are handing over.

**Consequences of the revision:**

- Self-hosters do **not** need to rebuild the extension. They register the
  published extension's redirect URI —
  `https://<extension-id>.chromiumapp.org/` — as an allowed redirect on their
  own dashboard's OAuth client. That is one-time dashboard-side configuration.
- `BASE_URLS` in `witty.config.json` remains the *build-time default* set and
  populates the `ApiSelector` dropdown.
- Phase 4 adds a proper "custom endpoint" field to the options page for users
  who need one, subject to invariants 1–4 above.
- The README gets a "Self-hosting" section covering both routes: configure at
  runtime, or bake your own defaults in at build time.

---

## 5. Target architecture

OAuth 2.0 Authorization Code + PKCE, driven from the extension's background
service worker via `identity.launchWebAuthFlow`.

```
 extension (background SW)          dashboard (Laravel/Passport)      nlp_api
 ─────────────────────────          ────────────────────────────      ───────
 verifier = random()
 challenge = S256(verifier)
 state = random()
        │
        │ launchWebAuthFlow(/oauth/authorize?…&code_challenge&state)
        ├──────────────────────────────────▶  Fortify login / register
        │                                     user consents
        │ ◀── 302 https://<ext-id>.chromiumapp.org/?code=…&state=…
        │     (intercepted by the browser; never reaches a web page)
        │
        │ verify state, then POST /oauth/token {code, code_verifier}
        ├──────────────────────────────────▶
        │ ◀── {access_token (RS256 JWT), refresh_token, expires_in}
        │
        │ access_token  → storage.session (in-memory, never on disk)
        │ refresh_token → storage.local
        │
        │ Authorization: Bearer <access_token>
        ├──────────────────────────────────────────────────────────▶ /v2.4/check
        │                                     validates via ◀───────┤ fetch JWKS
        │                                  /.well-known/jwks.json   │
```

Why `launchWebAuthFlow` is the right mechanism: the browser intercepts
`https://<app-id>.chromiumapp.org/*`, closes the auth window, and hands the final
URL **only to the extension**. No `web_accessible_resources` entry point, no
tokens in a page URL, no injection vector.

Why **Laravel Passport** with a **public client + PKCE** (no client secret — an
extension cannot keep one): it provides `/oauth/authorize`, `/oauth/token`,
refresh-token rotation and revocation out of the box, and its access tokens are
**RS256**, so the NLP API validates with a *public* key rather than us sharing
`app.key`. Hand-rolling auth-code+PKCE is the alternative; it means more code in
the highest-risk area of the system, so it is not recommended.

> **Note — Passport is not currently installed.** Verified 2026-08-04: there is
> no `laravel/passport` in `composer.json`, no `vendor/laravel/passport`, no
> `config/passport.php` and no `storage/oauth-*.key`. The single `laravel/passport`
> string in `composer.lock` is an unrelated package's dev-requirement. What the
> dashboard actually runs today is **Sanctum + Fortify + Jetstream +
> Socialstream**, plus `firebase/php-jwt` — which is what `browserLogin`
> hand-rolls its HS256 token with. The `connected_accounts` table's `token` /
> `refresh_token` columns come from Socialstream and are where the old Azure
> tokens were stored. Phase 1 therefore adds a new dependency rather than
> configuring existing infrastructure.

---

## 6. Phases

### Phase 0 — Stop the bleeding — **DONE**

Takes login from "broken" to "broken but not exploitable".

- [x] Removed the token-accepting code from `source/Options/Options.tsx` and
      dropped `options.html` from `web_accessible_resources` (both the Chrome and
      Firefox lists) in `source/manifest.json`. Kills the token-injection and
      open-redirect vectors. Also removed the now-dead `REDIRECT_URL_LOGIN`
      storage key, which was only ever written, never read.
- [x] `DEV_ENV` is now build-driven — `process.env.NODE_ENV !== 'production'`,
      substituted by the `webpack.EnvironmentPlugin` that was already configured.
      Added `source/shared/env.d.ts` for the ambient declaration.
- [x] `DefaultBaseUrlKey` derives from `DEV_ENV` (`Local` in dev, `Prod` in
      release) and falls back to the first configured key so a self-hosted config
      with a single custom entry still works. The three components that
      hardcoded `DEV_ENV ? 'Dev' : 'Prod'` now use it.
- [x] `setBaseUrls` validates its key against the compiled set and falls back to
      the default. A key read from extension storage is untrusted input: a stale
      `'Local'` left by a dev build would otherwise silently keep a release build
      pointed at localhost, and an unknown key threw on `BaseUrls[key].api`.
- [x] `ApiSelector` now logs out on *any* endpoint change. It previously only did
      so when switching to `'Prod'`, and compared against a typo'd `' Prod'`, so
      tokens were carried across between any other pair of endpoints.
- [x] `X_KEY` / `ACCESS_TOKEN` / `REFRESH_TOKEN` are centralised in
      `source/shared/constants.ts` and forced empty in release builds; all
      consumers now read those constants instead of `witty.config.json` directly.
- [x] `webpack.config.js` refuses to make a production build when any of the
      three is set, rather than silently neutering a key someone believed was
      active. Verified: the build fails with a clear message.
- [x] Fixed a latent bug in `getNewAccessToken`: it compared the stored access
      token against the configured default without checking for a non-empty
      value, so on an unauthenticated install (both `''`) it returned early and
      never reached the `logOut()` path.
- [x] Dashboard: added a dedicated `auth` rate limiter (10/min, keyed on IP
      since these requests precede any session) in `RouteServiceProvider`.
- [x] Dashboard: removed the dead `/api/refresh-token` route, which pointed at
      the deleted `accessTokenFromRefreshToken` and so was a public endpoint that
      500s. The extension now gets an honest 404 until Phase 1.

### Phase 1 — Dashboard OAuth2 server — **DONE** (verified live 2026-08-04)

Laravel Passport, with the extension registered as a **public PKCE client**
(client id `1`, not revoked) and both redirect URIs registered:
`https://<extension-id>.chromiumapp.org/` and the Firefox
`.extensions.allizom.org` equivalent. Matching is exact — a forged
`redirect_uri` returns 401, and a valid unauthenticated request 302s to
`/login`.

Access tokens carry a `kid` header and both `email` and `preferred_username`
claims; `/.well-known/jwks.json` serves the matching key. Verified end to end:
fetching that JWKS and checking the RS256 signature succeeds. `/oauth/token`
carries a 10/min per-IP throttle, and the dead `/api/refresh-token` route is
gone.

#### Contract the extension expects from the dashboard

The extension side is implemented against stock Passport. What the dashboard
must provide:

**Redirect URI to register on the OAuth client** (exact match, no prefix
matching). Derived from the extension ID, which is pinned by `manifest.json`'s
`key`:

| Browser | Redirect URI |
| --- | --- |
| Chrome / Opera | `https://meojhlodfiihbjkcnehkdcgncnhgagog.chromiumapp.org/` |
| Firefox | `browser.identity.getRedirectURL()` → `https://<uuid>.extensions.allizom.org/`, derived at runtime from the `{4b376457-…}` add-on ID |

Read the Firefox value by loading the add-on and evaluating
`browser.identity.getRedirectURL()` in its background console — it is stable per
add-on ID. Both must be registered.

**Client type:** public client with PKCE, i.e. `php artisan passport:client
--public`. No secret — an extension bundle cannot keep one. The resulting client
ID goes into `oauth_client_id` on the matching `BASE_URLS` entry in
`witty.config.json`; it is public by design.

**`GET /oauth/authorize`** — stock Passport. Called with `client_id`,
`redirect_uri`, `response_type=code`, `state`, `code_challenge`,
`code_challenge_method=S256`, and optionally `register=1`.
- `register=1` is a hint the extension sends when the user clicked "Sign up"
  rather than "Sign in". Passport ignores unknown params, so honouring it is
  optional — but if an unauthenticated user is redirected to login, that is the
  place to send them to the registration page instead.
- An unauthenticated user must be redirected to the Fortify login page and back
  into the authorize flow, **not** given a JSON 401 (which is what the interim
  `browserLogin` did).

**`POST /oauth/token`** — stock Passport, accepting JSON. Two grants:
- `authorization_code` with `client_id`, `redirect_uri`, `code`, `code_verifier`
- `refresh_token` with `client_id`, `refresh_token`

The extension persists both returned tokens on every refresh, so refresh-token
rotation is fine. It treats a missing `expires_in` as already-stale.

**`/.well-known/jwks.json`** — needed for Phase 3 so the NLP API can verify
access tokens locally instead of calling back on every `/check`.

### Commercial / upsell removal — **DONE** (2026-08-04)

Witty is no longer a commercial project, so the plan and upsell machinery went
with the auth rewrite:

- Deleted `PopupUpgrade.tsx` and `HighlightPopoverUpgrade.tsx` and their dispatch
  branches.
- Removed `StorageKeys.PLAN` and every read/write: the `'OFF'` badge in the
  background storage listener, `setWittyIcon`'s plan check, the `renderPopup`
  dispatch, `updateConfig`'s write, and the `extension-plan` DOM attribute.
- Removed `hasWittyLicense`, which was doing real work — `checkText` only called
  `setTextToCheck` when a license was present and `handleKeyupEventDebounced`
  bailed early without one. Both now run unconditionally.
- Removed `isWittyPremiumUserRef` (gated the debounce delay, the char-limit
  warning and `logNewCheckResponses`), `hasWittyTeams`, the `plan` fields on the
  API response types, and `response__plan` in analytics.
- Removed the trial-ended notification path and
  `TRIAL_ENDED_NOTIFICATION_SHOWN_DATE`, plus both `team/subscription` CTAs.
- Collapsed the config split: `MAX_CHAR_LENGTH_REQUEST_FREEMIUM` /
  `_TOTAL_FREEMIUM` became `MAX_CHAR_LENGTH_REQUEST` / `MAX_CHAR_LENGTH_TOTAL`;
  `MAX_CHAR_LENGTH_REQUEST_PREMIUM` and `API_DELAY_FREEMIUM` are gone.
- Dropped 33 orphaned de/en/fr translation entries and rewrote the char-limit
  copy, which previously read as an upsell ("Witty Freemium reviews {{limit}}
  characters… Get all Witty benefits!"). The limit itself is a real API
  constraint, so the warning stayed.
- **`IGNORED_CATEGORIES` was removed and stays removed** (decided 2026-08-04).
  It existed only so that dismissing the upgrade nag suppressed that category
  for seven days — `HighlightPopoverUpgrade`'s `hidePopover` was its sole
  writer, so with the upsell gone the read path filtered against a permanently
  empty array. The storage key, the `IgnoredCategory` type, the expiry load, the
  filter and `addIgnoredCategory` are all gone.

### Phase 2 — Extension OAuth — **DONE** (verified live 2026-08-04)

Verified end to end against the running dashboard (`__tests__/auth.e2e.spec.js`,
opt-in via `E2E_DASHBOARD` / `E2E_EMAIL` / `E2E_PASSWORD`):

- Authorization Code + PKCE via `identity.launchWebAuthFlow` completes.
- `refresh_token` grant returns a new pair, and Passport **does** rotate the
  refresh token — both values must be written back.
- Access token lands in `storage.session` and is **absent** from
  `storage.local`; the refresh token persists on disk.
- Dashboard rejects a forged `redirect_uri` with 401 and redirects an
  unauthenticated valid request to `/login` with 302.

Access token is now split across storage areas — see `source/shared/tokenStore.ts`.
`storage.session` is opened to content scripts via `setAccessLevel`, since the
popover and content script both need the bearer token; content scripts are
isolated worlds, so this grants no more reach than `storage.local` already had.

### Phase 3 input: what the dashboard actually issues

Captured from a live token, so the NLP API can be written against it:

```
header  { "typ": "JWT", "alg": "RS256", "kid": "0cROrhuSKHutMK5isV3MVBfg9RNJnn7WliL3QsBvNpY" }
claims  { "aud": "1", "sub": "1", "jti": "...", "iat": …, "nbf": …, "exp": …, "scopes": [] }
```

`GET /.well-known/jwks.json` serves the matching key (200, same `kid`), so the
NLP API can reuse its existing JWKS fetch-and-cache path rather than holding a
copied public key.

> **Blocker for Phase 3: the token carries no email claim.**
> `fetch_email_from_claims` in `app/auth_service.py` looks for `emails[0]` or
> `preferred_username`; neither is present. `sub` is the *user* id and `aud` is
> the *client* id — both happened to be `"1"` in this capture, which is a
> coincidence worth not building on. Either the dashboard adds an email (or
> equivalent) claim to the access token, or the NLP API resolves `sub` through a
> `/api/userinfo` call. Deciding this is the first Phase 3 step.
>
> The `aud`-based dispatch the NLP API already does works unchanged: configure
> its `client_id` as `"1"` and the existing loop matches.

### Phase 3 — NLP API: validate dashboard-issued tokens — *in progress (NLP side)*

Being done separately in the `nlp_api` repo; the task list moved there with it.

The blocker recorded earlier — that the token carried no email claim — is
**resolved**: the dashboard now emits both `email` and `preferred_username`, and
`fetch_email_from_claims` already reads the latter for the Office SSO path, so
extraction needs no change. `aud` is `"1"`, so the existing `aud`-based dispatch
matches once configured.

Nothing in the extension is waiting on this except the category toggles, which
hide themselves until the API reports a list.

### Phase 4 — Hardening and documentation — **DONE** (2026-08-04)

- [x] **`web_accessible_resources` removed entirely.** Every entry was either
      unused or nonexistent: the four SVGs are inlined by `@svgr/webpack` and
      never fetched by URL (nothing in the source calls `runtime.getURL` for an
      asset), and `assets/googleDocsSpellCheck.js` does not exist in the repo or
      in any build. `googleDocsSupport.js` is injected via `content_scripts`,
      which needs no WAR entry. Besides shrinking the attack surface this stops
      the extension being fingerprintable — any site could previously probe a
      web-accessible URL to detect it.
- [x] **`http://*/*` narrowed** to `https://*/*` plus `http://localhost/*` and
      `http://127.0.0.1/*`, in `host_permissions`, the Firefox `permissions`
      list, and the content-script `matches`.

      Note the original rationale for this item — "so tokens and page text never
      ride plaintext" — was **wrong** and is recorded here so it is not repeated:
      the token goes to the API over https regardless of the visited page's
      scheme, and page text is read locally then sent over https too. The real
      benefits are a smaller permission surface and a cleaner install prompt.
      The cost is that http intranet sites silently stop working; loopback is
      kept so local development and the Playwright fixtures still function.
- [x] **Custom endpoint UI** on the options page (`source/Options/Options.tsx`),
      upholding the section 4 invariants: settable only from the extension's own
      UI, clears credentials on change, requires https except for loopback, shows
      an explicit warning about what the configured server receives, and never
      becomes the build default. Registered through
      `registerCustomEndpoint`, which adds it to the runtime `BaseUrls` so the
      `ApiSelector`, `isAllowedBaseUrlKey` and `setBaseUrls` all keep working
      unchanged. Covered by `__tests__/options.spec.js`.
- [x] **README "Self-hosting" section** covering both routes (runtime
      configuration and baking your own defaults in), the redirect URIs to
      register per browser, and the rules the extension enforces.


---

### Phase 5 — API-key mode (no dashboard) — **DONE** (2026-08-04)

Lets a deployment run the NLP API alone and skip the dashboard entirely.

- Explicit **Account / API key** toggle on the options page. The two are
  **mutually exclusive**, enforced in `apiKeyFromStorage`: a key is only returned
  in API-key mode. Without that check a leftover key would silently outrank an
  account token, because `buildRequestHeaders` short-circuits on `x-key`.
- The key is stored as `{endpoint, value}` and only resolves while the two agree,
  so repointing the extension cannot carry a key to another deployment. That is
  structural rather than a cleanup step that has to fire.
- Distinct from the build-time `X_KEY`: that is a *shared* secret compiled into a
  distributable bundle (release builds refuse it); this is the user's own
  credential in their own profile.
- Dashboard-backed features are hidden rather than left to fail in key mode:
  domain sync (stays local), ignore-permanently, and the dashboard links. Domain
  sync mattered — it called `buildRequestHeaders`, so it would have POSTed the
  API key to a host that does not exist.
- Spell checking, AI suggestions and per-category toggles move to the options
  page. The category list renders from whatever the server reports and the
  section stays hidden while empty, so it lights up when the NLP API exposes one.
- The options page is reachable from the popup **including when signed out** —
  you need it before you can sign in to a self-hosted server.

Covered by `__tests__/options.spec.js`.

## 6b. Release order — website before extension — **CLEARED** (2026-08-04)

The extension links into the help centre, so the website had to deploy first.
It has, and all six links are verified live:

| Link | Production |
| --- | --- |
| `/help` | 200 |
| `/en/help/witty-doesnt-work` | 200 |
| `/en/help/how-can-i-update-witty` | 200 |
| `/en/help/how-do-i-customize-witty` | 200 |
| `/en/help/how-do-i-connect-witty-to-my-own-server` | 200 |
| `/en/help/can-i-use-witty-without-the-dashboard` | 200 |

The two retired articles 301 to `/help`, and every link on the live index
resolves.

All extension → website links are centralised in `HelpLinks`
(`source/shared/constants.ts`); the slugs must match the website registry at
`_includes/help-articles.php`. Re-check after any slug change — the extension
previously shipped five links to pages that no longer existed (`/demo`,
`/editor`, `/witty-for-teams`, `/goodbye`, and the HubSpot pin GIF).

## 7. Open questions

Both original questions are settled: Passport was chosen and is live, and `X_KEY`
stays for CI only — the user-entered API key supersedes it for real use, and
release builds refuse a baked-in one.

Still open:

- **Customisation toggles are overwritten in account mode.** `updateConfig`
  rewrites spell-checking and AI-suggestions from the server whenever the config
  hash changes. Correct as organisation-policy-wins, but it means those toggles
  are only durable in API-key mode.
- **Help article placement.** The two self-hosting articles are operator-facing
  in an otherwise end-user help centre. They are registry entries, so moving them
  to repo docs is cheap.
- **Lint is broken** (pre-existing, fails on `dev` too):
  `@abhijithvijayan/eslint-config` is not installed, so `npm run lint` cannot
  resolve its config. Everything is typechecked with `tsc` instead.
