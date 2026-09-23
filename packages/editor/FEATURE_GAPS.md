# Editor feature gaps

Browser extension features the editor component (`@witty-works/editor`) does not have yet, plus other open items from the reviews. Tick items off, or move them to the plan, as they land. See also [EDITOR_COMPONENT_PLAN.md](../../EDITOR_COMPONENT_PLAN.md).

## Accounts and configuration

- [ ] **OAuth sign-in** through the dashboard, with token refresh. The editor only takes an API key via `setApiKey`; the plan's `credentialProvider` (short-lived, scoped tokens) is not built either.
- [ ] **Organisation config from `/v2.0/auth`**: organisation defaults for AI suggestions, spell checking and categories, config hashes, and reacting to `config_changed`. Without it the settings panel shows the editor's local settings only, not what the organisation suggests or forces.
- [ ] **Minimum-version check**: the extension asks for an update when the API answers 400 for an outdated client; the editor reports a generic error.
- [ ] **Stored settings**: the extension keeps settings in browser storage; the editor hands changes to the host via `onSettingsChange` and remembers nothing itself.

## Checking

- [x] **Sentence cache and long texts** (2.1.0): the editor checks sentence by sentence in requests within the API's limit, caches per sentence, and resends only changed sentences. Unlike the extension it does not cache a batch the API cut short.
- [x] **Length limit** (2.1.0): `maxTextLength` (default 20000), reported as `limitReached` in `onStatus` and shown under the text. The plan's long-document policy is still open for collaboration (Phase 5).
- [ ] **HR add-on**: the extension sends `addons: ['hr']` unless disabled for the site; the editor sends no add-ons unless the host sets them in `config`.
- [ ] **Error-specific handling**: the extension clears alerts on 422 and refreshes the token on 403; the editor reports every error through `onStatus` and leaves the last alerts on screen.
- [ ] **Installation id**: the editor sends `client: "witty-editor:<version>"` (so the API can version-check it separately from the extension), but always `id: "witty-editor"`; the extension sends a random per-installation id.

## Popover actions

- [ ] **Ignore permanently** (dashboard ignore list); the button is hidden in the editor because it has no dashboard.
- [ ] **"Ignore once" across sessions**: it lasts for the lifetime of the editor instance, and matches the exact text only ("Guys" ≠ "guys").
- [ ] **Accept counters and invite nags** (`onAlternativeAccepted`); a no-op in the editor.
- [ ] **Formatting kept on LLM rewrites**: replacing a whole sentence inserts plain text, so bold or italic inside it is lost.

## Bugs found in the extension

- [ ] **Unchecked text counted as checked**: the extension's sentence cache stores every sentence it sent, including those past the API's `TEXT_MAX_LENGTH` cut-off (`limit_reached`), as checked with no alerts. In texts over 1000 characters (the API default) later sentences are never flagged. The editor's `sentenceCheck.ts` shows the fix: don't cache a batch that hit the limit, resend it smaller.
- [ ] **`MAX_CHAR_LENGTH_REQUEST`** in `witty.config.json` is read nowhere; requests are not split to fit the API's limit.

## Reporting and notifications

- [ ] **Analytics** (PostHog, dashboard log endpoint): the popover gets a no-op analytics object.
- [ ] **Sentry error reporting**: nothing is connected to the shared `reportError` hook, which the extension wires to Sentry.
- [ ] **Notifications**: "pin Witty", the post-update notice, the survey.

## Accessibility (from the review)

- [ ] **Underline contrast** (WCAG 1.4.11, 3:1): only red passes; orange 2.19:1, blue 2.67:1, green 1.63:1, yellow 1.23:1. Proposal: darker line shades, current colours kept for the fill. A brand decision shared with the extension.
- [ ] **Extension popup and sign-in buttons**: red primary and secondary buttons at 3.13:1 (not part of the editor).
- [ ] **Manual testing**: NVDA and VoiceOver pass, Windows high-contrast mode, 200% text zoom.

## Packaging and workflow

- [ ] **ES module build and TypeScript types** for bundler users; only the script-tag bundle is published.
- [ ] **Bundle size**: 287 kB gzipped. chroma-js is loaded but unused by the editor; Preact for the popover would save most of React.
- [ ] **Browser test of the editor in CI**, and CI running the unit tests, lint and the Firefox smoke suite. Unit tests: `npm run test:coverage -w @witty-works/editor` (coverage thresholds 95% statements, 85% branches). Not covered by them: opening the popover by clicking a highlight, which needs a real layout engine.
- [ ] **Root scripts** `dev:editor`, `test:unit`, `test:all`.
- [ ] **Flaky Google Docs e2e test** (`gdocs.spec.js`): it sometimes stalls without highlights, independent of code changes.
- [ ] **Order-dependent Firefox smoke tests**: "highlights a contenteditable" and "the content script answers the open-popover message" time out in full-suite runs but pass on their own, on older commits too.

## Only relevant in the extension

Per-site on/off and organisation site deny lists, toolbar badges, the popup, a configurable keyboard shortcut (the editor's Alt+Shift+W is fixed), and the site-specific handling for Google Docs, Microsoft Office Online and iframes.
