# Editor feature gaps

Browser extension features the editor component (`@witty-works/editor`) does not have yet, plus other open items from the reviews. Tick items off, or move them to the plan, as they land. See also [EDITOR_COMPONENT_PLAN.md](../../EDITOR_COMPONENT_PLAN.md).

## Accounts and configuration

- [ ] **OAuth sign-in** through the dashboard, with token refresh. The editor only takes an API key via `setApiKey`; the plan's `credentialProvider` (short-lived, scoped tokens) is not built either.
- [ ] **Organisation config from `/v2.0/auth`**: organisation defaults for AI suggestions, spell checking and categories, config hashes, and reacting to `config_changed`. Without it the settings panel shows the editor's local settings only, not what the organisation suggests or forces.
- [ ] **Minimum-version check**: the extension asks for an update when the API answers 400 for an outdated client; the editor reports a generic error.
- [ ] **Stored settings**: the extension keeps settings in browser storage; the editor hands changes to the host via `onSettingsChange` and remembers nothing itself.

## Checking

- [ ] **Sentence cache** (`useSentenceCache`): the extension re-checks only changed sentences; the editor sends the whole document on every check.
- [ ] **Length limit** (`MAX_CHAR_LENGTH_TOTAL`) with the warning icon and explanation; the editor has no limit and ignores `limit_reached`. Part of the plan's open long-document policy.
- [ ] **HR add-on**: the extension sends `addons: ['hr']` unless disabled for the site; the editor sends no add-ons unless the host sets them in `config`.
- [ ] **Error-specific handling**: the extension clears alerts on 422 and refreshes the token on 403; the editor reports every error through `onStatus` and leaves the last alerts on screen.
- [ ] **Client identity**: every editor sends `id: 'witty-editor-poc'` and version `editor-0.0.0`, so the API cannot tell users or releases apart.

## Popover actions

- [ ] **Ignore permanently** (dashboard ignore list); the button is hidden in the editor because it has no dashboard.
- [ ] **"Ignore once" across sessions**: it lasts for the lifetime of the editor instance, and matches the exact text only ("Guys" ≠ "guys").
- [ ] **Accept counters and invite nags** (`onAlternativeAccepted`); a no-op in the editor.
- [ ] **Formatting kept on LLM rewrites**: replacing a whole sentence inserts plain text, so bold or italic inside it is lost.

## Reporting and notifications

- [ ] **Analytics** (PostHog, dashboard log endpoint): the popover gets a no-op analytics object.
- [ ] **Error reporting**: nothing is connected to the shared `reportError` hook (Sentry in the extension).
- [ ] **Notifications**: "pin Witty", the post-update notice, the survey.

## Accessibility (from the review)

- [ ] **Underline contrast** (WCAG 1.4.11, 3:1): only red passes; orange 2.19:1, blue 2.67:1, green 1.63:1, yellow 1.23:1. Proposal: darker line shades, current colours kept for the fill. A brand decision shared with the extension.
- [ ] **Extension popup and sign-in buttons**: red primary and secondary buttons at 3.13:1 (not part of the editor).
- [ ] **Manual testing**: NVDA and VoiceOver pass, Windows high-contrast mode, 200% text zoom.

## Packaging and workflow

- [ ] **ES module build and TypeScript types** for bundler users; only the script-tag bundle is published.
- [ ] **Bundle size**: 287 kB gzipped. chroma-js is loaded but unused by the editor; Preact for the popover would save most of React.
- [ ] **Browser test of the editor in CI**, and CI running the unit tests, lint and the Firefox smoke suite.
- [ ] **Root scripts** `dev:editor`, `test:unit`, `test:all`.
- [ ] **Flaky Google Docs e2e test** (`gdocs.spec.js`): it sometimes stalls without highlights, independent of code changes.

## Only relevant in the extension

Per-site on/off and organisation site deny lists, toolbar badges, the popup, a configurable keyboard shortcut (the editor's Alt+Shift+W is fixed), and the site-specific handling for Google Docs, Microsoft Office Online and iframes.
