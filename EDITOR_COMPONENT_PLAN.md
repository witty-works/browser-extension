# Plan: Witty as an embeddable editor web component

Goal: a web component (working name `<witty-editor>`) that offers Witty's checking — highlights, explanation popover, alternatives, ignore lists — as an editor others can embed, instead of an overlay injected into someone else's page. This document lays out the options, what each costs, and a recommended path. (Revised 2026-08-08 after external review; see "Contracts and invariants".)

## What we already know (from the extension)

The lessons in [EDITORS.md](EDITORS.md) are the core input to this decision:

- Nearly all of the extension's complexity and fragility comes from *not owning the editor*: clone elements to measure text, canvas overlays to paint under someone else's DOM, synthetic Delete+paste sequences because model-based editors revert foreign edits, per-site caret and z-index special cases.
- The pieces that are *not* editor-entangled are solid and reusable: the check API client with caching and diff-based alert-offset adjustment, the LLM alternatives cache, the alert/category model, i18n (de/en/fr), and a popover that is now fully keyboard-accessible (dialog semantics, Escape, real buttons, shortcut plumbing).
- Auth for an embedded component cannot use `browser.identity`; the API-key (X_KEY) mode built recently is the right fit, optionally alongside a token-provider callback for logged-in dashboard use.

Owning the editor eliminates the entire overlay problem class. The question is how much editor to own.

## Option A — ship an established editor, integrate via its annotation API

Embed a full editor (CKEditor 5 or TinyMCE) inside the web component and implement Witty as a plugin using the editor's marker/annotation API — the model WProofreader and similar checkers use.

- **A1: CKEditor 5 plugin.** Model *markers* render highlights as classed spans; the popover becomes a `BalloonPanel` (or our own floating element). Replacements go through the model API — undo-safe, no synthetic-event hacks ever again.
- **A2: TinyMCE annotations API.** Same shape; we already know its iframe mode is hostile to outside code, but as the *owner* we would configure it ourselves.

**Pros:** fastest path to a rich editor (toolbars, lists, tables, undo, images come free); replacement robustness is total; both editors are battle-tested on IME/mobile/paste edge cases we would otherwise own.

**Cons / the presentation ceiling:**
- Highlight rendering is whatever classed inline spans can do. CSS wavy/colored underlines are fine; anything beyond (hover-swap explanation previews, animated emphasis, overlap handling like the extension's canvas gives) must fight the editor's rendering pipeline.
- Popover UX is pushed toward the editor's UI framework and theming; our existing React popover can be mounted, but positioning inside their balloon/z-index system is friction.
- **Licensing is the real constraint:** CKEditor 5 and TinyMCE are GPL or commercial. Shipping either inside a component embedded in users' proprietary sites means paying for commercial licenses (per-product pricing) or imposing GPL on embedders — likely a deal-breaker for a product component.
- Bundle weight (several hundred kB min+gz before our code) and upgrade churn on a foreign major-version cadence.

### A′ — are there permissively licensed full editors instead?

Surveyed alternatives to CKEditor/TinyMCE among batteries-included editors (status as of early 2026 — licenses are stable facts, but re-verify maintenance activity before committing):

| Editor | License | State | Checker-highlight mechanism | Fit |
|--------|---------|-------|------------------------------|-----|
| Quill 2.x | BSD-3 | active | custom Parchment inline formats via Delta ops | closest permissive candidate, but see below |
| Toast UI Editor | MIT | active | ProseMirror inside (v3), markdown-first UX | fighting its markdown model; if we're using PM anyway, use PM directly |
| Trix (Basecamp) | MIT | maintained, slow | closed-ish document model, attachment-centric | no annotation surface |
| Jodit | MIT | active (solo-maintainer) | raw DOM spans, execCommand-style core | no model → same fragility we're escaping |
| SunEditor | MIT | slowing | raw DOM spans | same |
| Editor.js | Apache-2.0 | active | block-based JSON; inline tools are per-block | cross-block highlight ranges effectively impossible |
| Summernote | MIT | legacy (jQuery) | raw DOM | no |
| CKEditor 4 | LGPL | **EOL 2023** | — | no (unpatched security) |
| CodeMirror 6 | MIT | very active | best decoration API of any editor | plain-text/code substrate — wrong medium for WYSIWYG, listed for completeness |

**The crux finding:** among permissively licensed *full* editors, none offers a first-class annotation/marker API comparable to CKEditor 5 markers or TinyMCE annotations. The "established spellchecker API" shape effectively only exists behind GPL/commercial licensing.

The nearest permissive approximation is **Quill**: highlights as custom inline formats applied through Delta operations, replacements through the same API (robust, undo-integrated — and we already know from the e2e work that Quill is well-behaved). But Quill formats live *inside* the document model: highlight spans travel with copy/paste, entangle the undo history (partially mitigable with `history: {userOnly: true}` and `'api'`/`'silent'` sources), and must be scrubbed on export. Every checker built this way fights that pollution forever. ProseMirror decorations exist precisely to keep annotations *out* of the document — which is the whole reason Option B leads. (The same in-model caveat applies to Lexical's MarkNode approach, which is how Meta's own comments plugin works.)

If a batteries-included permissive editor were mandatory, Quill would be the pick — accepted as a conscious trade of model purity for shipped features. It is a defensible fallback, not the recommendation.

## Option B — build the editor on a headless toolkit (own the presentation)

Use a low-level, MIT-licensed editor engine and build Witty's presentation on top.

- **B1: ProseMirror (optionally via TipTap).** The strongest technical fit:
  - *Decorations* are purpose-built for checkers: inline highlight ranges that render without touching the document model.
  - *Transaction mapping* shifts decoration positions automatically on every edit — it replaces the entire `diffChars`/`adjustLocalAlertPositions` machinery with a built-in primitive.
  - Replacements are transactions: undo-safe, collaborative-editing-ready.
  - Headless: highlights, popover, toolbar, theming are 100% ours — the existing popover (with its fresh a11y model) mounts directly, positioned by floating-ui, which is already a dependency.
  - TipTap adds ergonomics and a large extension ecosystem on MIT terms; raw ProseMirror maximizes control with a steeper learning curve. Note TipTap's *Pro* tier (comments, collab history, conversions) is paid — the checker needs none of it, but pin the dependency to core+starter-kit so the boundary stays visible.
  - Other ProseMirror-based frameworks exist if TipTap's direction ever sours: remirror (MIT), Milkdown (MIT, markdown-centric), BlockNote (MPL-2.0, Notion-style blocks). All inherit PM decorations; TipTap has the largest ecosystem.
- **B2: Lexical (Meta, MIT).** Modern and React-friendly, but its decoration/annotation story is younger than ProseMirror's and the API still churns; a riskier foundation for a product component.
- **B3: Slate.** React-only, historically unstable APIs — not recommended as a foundation. (Plate, MIT, layers a large and very active component ecosystem on Slate and does have a decorations concept — better DX, same foundation risk.)

**Pros:** full presentation control (the stated concern with Option A disappears); MIT licensing end to end; moderate bundle (~100–150 kB gz with TipTap starter kit); a11y is fully in our hands — we can bake in the keyboard model from #927 properly (aria-live announcements of new alerts, shortcut navigation, focus management) rather than retrofitting it.

**Cons:** we own editor scope — toolbar, paste sanitization, feature requests ("can it do tables?") land on us. Mitigation: keep the MVP feature set deliberately small (Witty is a writing checker, not a Word clone) and lean on TipTap extensions where needed.

## Option C — no editor: a wrapper/overlay web component

`<witty-check>` wrapping a slotted host-provided `textarea`/contenteditable — the model of Grammarly's `grammarly-editor-plugin`. This is not "an editor as a component" but it is the cheapest way to offer embedding.

- **C1: fully custom contenteditable engine — rejected.** Reinventing ProseMirror (IME composition, undo stacks, mobile carets, paste) is the known graveyard; nothing about Witty's value depends on owning that layer.
- **C2: overlay wrapper.** Reuses the extension's existing overlay machinery almost verbatim, packaged for first parties instead of injected. Inherits every fragility EDITORS.md documents, but for cooperative hosts (they choose the field type) the worst cases disappear.

Worth keeping on the roadmap as a *secondary* offering — it shares the same core and serves "add Witty to the editor you already have" — but it does not answer the brief of providing an editor.

## Comparison

| | A: CKE/TinyMCE plugin | B1: ProseMirror/TipTap | C2: overlay wrapper |
|---|---|---|---|
| Time to demo | ~fast | medium | fastest (code exists) |
| Presentation control | limited (the stated concern) | **full** | full popover, fragile highlights |
| Replacement robustness | native model API | native transactions | synthetic events (fragile) |
| Position tracking on edits | editor markers | **built-in mapping** | our diff machinery |
| Licensing for embedding | GPL/commercial ⚠ | MIT | MIT (ours) |
| Bundle (min+gz, rough) | 300 kB+ | 100–150 kB | ~50 kB |
| A11y ceiling | theirs, patched | **ours by construction** | limited by host page |
| Long-term maintenance | foreign major versions | scoped to our features | per-host quirks forever |
| Ease of integration (docs, types, wrappers) | good docs, plugin API learning curve | TipTap: excellent docs/types, official React/Vue bindings | trivial (ours) |
| Community / backing | company-backed (sales-driven) | PM: 10y stable, crowdfunded; TipTap: VC-backed GmbH; Lexical: Meta | n/a |
| Editor-level a11y (SR/IME/toolbar) | mature, documented WCAG/508 statements | contenteditable a11y is solid; toolbar patterns are ours to build | host's problem |
| Mobile / IME robustness | battle-tested | PM handles composition well; must verify in spike | inherits host quirks |

## Further evaluation dimensions

Dimensions beyond the table that should shape the decision and the Phase 0 spike — several are ones we already have first-hand data on:

- **Shadow DOM compatibility.** The single most component-specific risk. `contenteditable` + the Selection API inside shadow roots is a known browser minefield (Safari's `getSelection()` historically cannot see into shadow roots; `getComposedRanges` is the newer answer with uneven support). ProseMirror and Lexical each carry their own workarounds. This may force the editable region into light DOM with scoped-style discipline while only the popover/toolbar live in the shadow root. Must be a Phase 0 exit criterion, tested in Safari specifically.
- **Editor-level a11y.** Distinct from our popover a11y (which we own regardless): screen-reader behavior of the editable itself, toolbar keyboard patterns (roving tabindex), and how alert underlines are announced. CKEditor publishes WCAG 2.x / Section 508 conformance statements — the strongest paper trail; with headless toolkits conformance is ours to earn. Given Witty's inclusion brand, budget for a real NVDA/VoiceOver test pass, not just axe scans. The #927 keyboard model (shortcut to popover, aria-live counts) ports to any option.
- **Community health, measured.** Release cadence and issue triage over the last 12 months, bus factor (ProseMirror is essentially Marijn Haverbeke + crowdfunding — extremely stable but a single maintainer; TipTap is a VC-funded GmbH — active but watch open-core drift of features into Pro; Lexical is Meta-backed — active but 0.x API churn), and hiring/knowledge availability (TipTap and Quill have the largest tutorial/Stack Overflow footprint).
- **i18n and input methods.** IME composition (CJK), RTL text, and grapheme-safe offset handling — our alert offsets are character-based and must not split surrogate pairs or composed sequences. Full editors ship UI locales incl. de/fr; headless means our own strings (we already have the i18n pipeline).
- **Paste sanitization.** Users will paste from Word and Google Docs. Full editors ship mature paste-cleanup; TipTap inherits decent ProseMirror parsing but expect to configure/extend it. Also the XSS surface of HTML export — whoever renders our output must get sanitized HTML by default.
- **CSP compatibility.** The component will run inside hosts with strict Content-Security-Policy (we just fought CSP for a GIF in the extension). No inline styles/scripts required by the engine; constructable stylesheets in the shadow root avoid `style-src` friction. Verify TipTap/PM impose nothing.
- **Performance at alert scale.** Hundreds of decorations on a long document while typing: PM decoration mapping is designed for exactly this (checkers like Grammarly-class tools build on it), but the spike must measure request volume, decoration count, memory, and typing latency under explicit targets — feeding the long-document policy in "Contracts and invariants" rather than silently inheriting the extension's 2000-char cap.
- **Testing story.** We have direct evidence from the e2e work: Quill is cooperative with synthetic input; CKEditor wipes foreign DOM attributes and fights outside automation. Headless PM/TipTap under our own component avoids the fighting entirely — and the component becomes a first-class Playwright fixture (the plan's Phase 4 already reuses this repo's fixture-server pattern).
- **Versioning/migration history.** Quill went years between 1.x and 2.0; Lexical is still 0.x; ProseMirror's core APIs have been stable since ~2017; TipTap's majors have been breaking (1→2, 2→3 — 3.x is the current documented line). Pin exact versions, adopt an explicit dependency/security update policy, and validate against the vanilla/custom-element integration rather than only the React wrapper the docs lead with.
- **Framework coupling and payload honesty.** Our popover is React, so React (~45 kB gz) rides along inside the component regardless of engine choice — the bundle numbers above should be quoted including it, and a later Preact/vanilla port of the popover is the lever if payload becomes an adoption objection. Slate/Plate and lexical-react would double down on React; PM/TipTap core stay framework-free.
- **Feature ceiling if enterprise asks.** Tables, comments, track changes, footnotes: CKE/TinyMCE have them today; TipTap has tables free and comments/history in paid Pro; raw PM has community implementations of everything at varying quality. Relevant only if the component's audience turns out to be "replace our intranet editor" rather than "a writing-check surface".
- **Collaboration-readiness.** Now a confirmed requirement (decision 3 below); Yjs has first-class bindings for ProseMirror/TipTap and Lexical, none meaningful for Quill 2 or the DOM-based editors — which by itself eliminates every candidate outside the ProseMirror family and Lexical.

These dimensions turn into the concrete Phase 0 deliverables list in the phased plan (offset-mapping contract, staleness handling, the DOM fork, collaboration invariants, popover-through-adapters, and the long-document measurements).

## Recommendation

**B1 — TipTap on ProseMirror — as the foundation**, with the shared core extracted first so the extension, the component, and any future Option-A integration plugins consume the same logic. Option A's licensing alone disqualifies it as the *foundation* of an embeddable product, and its presentation ceiling is precisely the limitation the brief worries about — but an Option-A CKEditor/TinyMCE *plugin* built on the same core is a good later offering for users who already run those editors (provided as an integration, licensing is then their problem).

## Contracts and invariants

Design commitments that must be settled *before* the public component shape freezes — deferring any of these bakes their absence into the API. Added after external review of this plan.

- **Text extraction and offset mapping.** The check API speaks plain-text offsets; a ProseMirror document has blocks, tables, links, mentions, atom nodes, and marks. Decorations only solve mapping under *subsequent edits* — the initial conversion is our contract to define: which node types contribute checkable text, a reversible plaintext-offset ↔ PM-position map, how block and table-cell boundaries are represented in the extracted text (word joins across cells must not create phantom flags), and how atom nodes and non-text marks are excluded. This is a Phase 0 deliverable with tests, not an implementation detail.
- **Result staleness.** A check response can arrive after the document has changed — trivially while typing, guaranteed under collaboration. Every request carries a document revision/fingerprint; in-flight requests are cancellable; a strict acceptance rule decides per response: map it through all intervening transactions, or discard and recheck. During IME composition, checking is deferred entirely. Alert identity across rechecks (so an open popover doesn't flicker away) is part of this contract.
- **Long-document policy.** An explicit decision replaces the extension's inherited 2000-char cap: full checking with a hard limit, viewport-windowed checking, sentence/paragraph chunking, or progressive whole-document processing. Chosen against measured targets (request volume, decoration count, memory, typing latency), not assumed.
- **Component API.** `input` alone is not an API. To specify: controlled vs uncontrolled content; canonical content format is editor JSON with explicit, lossy-by-declaration HTML/plaintext exports; form association via ElementInternals (`disabled`, `readonly`, participation in form submission); typed `CustomEvent` details with deliberate `bubbles`/`composed` choices; lifecycle cleanup on disconnect. React/Vue packages are thin adapters over this single contract, never parallel implementations.
- **Credentials and backend posture.** No API key in an HTML attribute — attributes are readable and exfiltratable by any script on the host page, and this repo already has a hard rule that shared build-time X_KEY credentials must never ship. Instead: a JavaScript-only `credentialProvider` property returning short-lived, scoped tokens. The backend side is part of the product: origin allowlists, per-tenant rate limits, CORS policy, tenant isolation, and a privacy/data-retention statement for checked text.
- **Schema stability before persistence.** Consumers will store editor JSON, so the document schema — including table/image/mention/link nodes — is enabled and versioned from the first persisted release, even while their toolbar UI stays feature-gated. Otherwise every later schema addition is a content migration and a checker-semantics change.
- **DOM architecture default.** Start with the editable in light DOM inside the custom-element host, with popover/toolbar UI in the shadow root; the editable moves into Shadow DOM only after Safari selection, focus, clipboard, and popover anchoring are proven there. Shadow-everything is the goal, not the assumption.

## Decisions (settled 2026-08-08)

1. **Audience: witty.works website, the dashboard, and company-internal CMS/CRM embedding.** This confirms the constraints that drove the recommendation: permissive licensing is mandatory (proprietary hosts), API-key auth suffices at launch (token-provider callback for the dashboard), and the CSP/Shadow-DOM dimensions are first-class because host environments are not ours.
2. **Feature floor: tables/images/mentions are wanted — and with TipTap this is plugin work, not building.** `@tiptap/extension-table` (prosemirror-tables), `@tiptap/extension-image`, and `@tiptap/extension-mention` (on `@tiptap/suggestion`) are free MIT extensions. Our share is app wiring: an image upload backend + drop/paste handling, the mention data source and dropdown UI, and working through known rough edges (table column-resize UX, merged cells). The paid Pro tier (drag handles, docx import/export, comments UI, version history) stays out of the MVP. Move tables/images/mentions from "optional" into Phase 4.
3. **Collaboration: yes.** This hardens B1 further — the Yjs ecosystem's first-class bindings are exactly ProseMirror/TipTap (`@tiptap/extension-collaboration` + collaboration-cursor are free; Hocuspocus, TipTap's Yjs backend, is MIT and self-hostable). Architectural consequence for the checker: alerts stay *client-local* and checking state never enters the shared document; decoration transaction mapping is the primary position-tracking mechanism (Yjs relative positions only if alert anchors ever need to survive cross-session), and the binding constraint is that every analysis result is versioned against the shared document state — see the staleness invariant. Rollout becomes Phase 5, displacing the CKE/TinyMCE integration plugins to "if ever demanded", but its invariants are proven in Phase 0.
4. **Packaging: monorepo in this repo.** npm workspaces: `packages/core` (platform-neutral checking domain — no React/DOM/browser APIs), `packages/ui` (popover view model + React view + styles), `packages/editor` (`<witty-editor>`), with the extension consuming `core` and `ui` via the workspace. Keeps single-person development in one place with one e2e suite; publishing `@witty-works/*` to npm or unbundling into separate repos is a later, mechanical step if the team grows.
5. **Build tooling: Vite for the new packages, webpack stays for the extension.** The Phase 0 spike page and `packages/core`/`ui`/`editor` are greenfield — Vite (library mode for the packages) is the right default there, and workspaces make mixed toolchains a non-issue. The extension's webpack setup is *not* migrated now: it encodes real, working machinery (wext-manifest per-browser transforms, the `__firefox__`-prefixed manifest keys, SVGR, the test-build layout the whole e2e suite keys off), a migration would risk a functioning release pipeline for zero user-visible gain mid-restructuring, and the CRX-on-Vite plugin ecosystem is exactly the kind of foreign dependency churn this plan avoids. Revisit only if maintaining two toolchains produces actual friction — likely at the point the extension consumes extracted packages and its own build shrinks. Note: recent Vite majors need Node ≥ 20; the repo pins `^18`, so the engine constraint gets bumped when the first package lands.

## Phased plan

**Phase 0 — spike (timeboxed ~2–3 weeks, can run in parallel with Phase 1).** A throwaway TipTap (3.x, vanilla/custom-element integration — not the React wrapper) page wired to the real check API. Deliverables, each with tests where it is a contract:

1. The **text-extraction/offset-mapping contract** from "Contracts and invariants": checkable-node rules, reversible offset↔position map, block/cell boundary behavior, atom/mark exclusion.
2. **Staleness handling**: revision-stamped requests, cancellation, and the map-or-discard acceptance rule exercised by editing during an in-flight check; checking deferred during IME composition.
3. **Light-vs-shadow DOM fork**: light-DOM editable + shadow-root UI first; Safari selection, focus, clipboard, and popover anchoring decide whether the editable may move into the shadow root.
4. **Collaboration invariants**: one remote Yjs transaction arriving mid-check, one concurrent alternative application from two clients, and undo semantics across both — proving the staleness protocol under the hardest conditions before any component API freezes.
5. **Popover-over-decorations**: the popover UI mounted against decorations *through adapters* (its storage/analytics/positioning inputs mocked) — the popover is extension-coupled today, so the spike measures the size of that adapter work rather than pretending it is zero.
6. **Long-document measurements** feeding the policy decision: request volume, decoration count, memory, typing latency under explicit targets; plus Word/GDocs paste.

**Phase 1 — decouple inside the extension.** Remove the hidden platform coupling *in place*, where the existing e2e suite proves nothing broke — this is what makes the Phase 2 extraction a file move instead of a rewrite. Each item lands independently:

1. **Workspace scaffolding:** convert the repo to npm workspaces without moving code (root becomes a workspace host, extension stays put), so later extractions are `git mv`s instead of a big bang.
2. **Storage adapter:** `source/shared` is laced with `webextension-polyfill` (storage helpers, token store, config reads). Put `browser.*` behind a small storage interface injected at the extension entry points; the component later supplies a localStorage/memory implementation.
3. **Error-reporting seam:** shared code imports `@sentry/react` directly in seven files. Wrap behind a `reportError` interface — component consumers must not be forced into Sentry or our DSN.
4. **De-browserify the popover:** `HighlightPopover.tsx` reads `browser.storage` for the LLM flag and dashboard availability (should arrive as props), performs the ignore-permanently dashboard `fetch` itself (should be a callback/service), and uses `browser.alarms` for a 1-second delayed hide where `setTimeout` does the job. Afterwards the popover's inputs are props + an API service — exactly its shape inside `<witty-editor>`. Guard-rail first: add an e2e test pinning ignore-once/ignore-permanently, the one popover flow the suite doesn't yet cover.
5. **Relocate `getActiveDocument`** from `ContentScript/ContentScriptApp` to `shared/` — it is already just a getter/setter pair, but it ties shared code to the content-script module graph.
6. **i18n init as a function:** replace the side-effect imports (`import '../../i18n/i18n'`) with an `initI18n()` called at entry points, so core can expose it to consumers who run their own i18next.
7. **De-hook the API layer:** `useCheckEndpointWithCache`, `useLLMAlternativesCache`, and friends are React hooks — not reusable "core". Reshape each into a plain-TypeScript service (fetch/cache/diff logic) with a thin hook wrapper the extension keeps using; the service is what Phase 2 extracts.
8. **Popover view model:** separate the popover's data/behavior (alert, alternatives, navigation, ignore actions) from its rendering, so Phase 2 can export a framework-neutral view model plus the React view — instead of promising the current extension-coupled component "just works" elsewhere.
9. **Hygiene while passing through (optional):** delete or explicitly document the dead Microsoft-Online branches behind the `ContentScriptApp` early return, drop commented-out code, replace the deprecated global-`event` uses in `Input.tsx`.

Items 2–4 and 7–8 are the real de-riskers; 1, 5, and 6 are afternoon-sized.

**Phase 2 — extract the packages.** With the coupling gone, split along the review's line: `packages/core` is the platform-neutral checking domain — API client services, alert model, offset mapping, staleness protocol, i18n resources — with **no React, no DOM, no browser-extension APIs, no storage** (all injected); `packages/ui` holds the popover view model + React view and its stylesheet, split out of the global `contentScript.css` into a unit injectable as a constructable stylesheet. Tighten the `IAlert`/check-response types here — they become core's public contract. The extension becomes the first consumer of both, with the e2e suite as the safety net.

**Phase 3 — `<witty-editor>` MVP.** Custom element in `packages/editor` implementing the full component API contract (controlled/uncontrolled, canonical JSON + declared-lossy HTML/text exports, ElementInternals form association, disabled/readonly, typed composed events, lifecycle cleanup). DOM architecture per the proven Phase 0 fork (light-DOM editable unless shadow passed). Editing feature set: TipTap starter kit *plus* the full versioned schema including table/image/mention/link nodes (decision 2 / schema-stability invariant) with their toolbar UI still feature-gated. Witty behaviors: debounced checking under the staleness protocol, gravity-colored underlines, popover with alternatives/LLM suggestions/ignore, the #927 keyboard model, `aria-live` alert announcements, de/en/fr. Credentials via the `credentialProvider` property only — no key attributes — against the backend posture from "Contracts and invariants".

**Phase 4 — productize.** Toolbar/UX for the already-shipped table, image, and mention nodes (per decision 2: plugin wiring — upload backend, mention source — not editor building); theming via CSS custom properties; docs + examples; npm publish with React/Vue thin-adapter wrappers over the one contract; Playwright e2e suite reusing this repo's fixture-server pattern (the editor finally becomes a first-class fixture instead of a foreign body); dashboard editor migrates onto the component (replacing `isWittyEditor` special-casing).

**Phase 5 — collaboration rollout.** Yjs via `@tiptap/extension-collaboration` + collaboration-cursor with a self-hosted Hocuspocus backend — gated on the Phase 0 collaboration invariants having passed and the staleness protocol being in production. Checker alerts remain client-local (decision 3). Includes revisiting the long-document policy under shared editing.

**Phase 6 — only if demanded.** CKEditor 5 / TinyMCE integration plugins on the same core for users with established editors; the C2 overlay wrapper.
