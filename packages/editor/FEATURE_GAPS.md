# Editor feature gaps

Browser extension features the editor component (`@witty-works/editor`) does not have yet, plus other open items from the reviews. Remove items as they land, or move them to the plan; the list only shows what is still open. See also [EDITOR_COMPONENT_PLAN.md](../../EDITOR_COMPONENT_PLAN.md).

## Accounts and configuration

- [ ] **OAuth sign-in** through the dashboard, with token refresh. The editor only takes an API key via `setApiKey`; the plan's `credentialProvider` (short-lived, scoped tokens) is not built either.
- [ ] **Organisation config from `/v2.0/auth`**: organisation defaults for AI suggestions, spell checking and categories, config hashes, and reacting to `config_changed`. Without it the settings panel shows the editor's local settings only, not what the organisation suggests or forces.
- [ ] **Stored settings**: the extension keeps settings in browser storage; the editor hands changes to the host via `onSettingsChange` and remembers nothing itself.

## Checking

- [ ] **HR add-on**: the extension sends `addons: ['hr']` unless disabled for the site; the editor sends no add-ons unless the host sets them in `config`.

## Popover actions

- [ ] **Ignore permanently** (dashboard ignore list); the button is hidden in the editor because it has no dashboard.
- [ ] **"Ignore once" across sessions**: it lasts for the lifetime of the editor instance, and matches the exact text only ("Guys" ≠ "guys").
- [ ] **Accept counters and invite nags** (`onAlternativeAccepted`); a no-op in the editor.
- [ ] **Formatting kept on LLM rewrites**: replacing a whole sentence inserts plain text, so bold or italic inside it is lost.

## Bugs found in the extension

- [ ] **Highlight off its word in a wrapped textarea**: in `__tests__/fixtures/textarea.html`, with a text wrapping over several lines, the highlight of "guys" in the last sentence is drawn about twelve characters to its right, under "welcome."; the same text in a contenteditable is placed correctly. Probably the textarea clone wrapping differently from the textarea. Found with `__tests__/longText.spec.js`, which uses a contenteditable for that reason.

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
- [ ] **Flaky Google Docs e2e test** (`gdocs.spec.js`): it sometimes stalls without highlights, independent of code changes.
- [ ] **Order-dependent e2e tests**: in Firefox, "highlights a contenteditable" and "the content script answers the open-popover message" time out in full-suite runs but pass on their own, on older commits too. In Chromium, a full local run (2026-09-24) failed four tests in `editors.spec.js` (CKEditor popover), `ignore.spec.js` (API-key mode) and `runtimeErrors.spec.js` that passed when run on their own. CI retries failed tests twice (`retries` in `playwright.config.js`), which hides these rather than fixing them.

## Only relevant in the extension

Per-site on/off and organisation site deny lists, toolbar badges, the popup, a configurable keyboard shortcut (the editor's Alt+Shift+W is fixed), and the site-specific handling for Google Docs, Microsoft Office Online and iframes.
