# Editor support

How the extension handles the editors it runs in, what is special-cased where,
what is known to be broken or unsupported, and what the test suite covers.
File references point at the current source; the detection predicates all live
in [source/shared/DOMutils.ts](source/shared/DOMutils.ts).

## The three handling tiers

1. **Native fields** — `<textarea>` (and `input[type=text]`, currently
   disabled to avoid capturing passwords). The extension renders an invisible
   *clone* of the field (`TextAreaClone`/`InputTextClone`) to measure text
   geometry, paints highlights onto a canvas overlay, and applies
   replacements with `element.selectionStart/End` + `execCommand('insertText')`
   (deprecated, but the only way that preserves the page's undo stack).

2. **Generic contenteditable** — anything with `contentEditable === 'true'`.
   No clone needed; alert offsets refer to the element's own text nodes,
   replacements select a DOM Range and insert over it. Editors that reconcile
   DOM changes back into an internal model (Quill, inline TinyMCE, ProseMirror
   derivatives) work through this path *if* they accept the synthetic edit.

3. **Special-cased editors** — detected per element or per URL, with their own
   branches for cloning, caret handling, replacement, and canvas positioning.
   Details below.

## Embeddable editors

### CKEditor 5 — supported, covered by tests

- **Detection:** element inside `.ck-content` (`isCkEditor`).
- **Why special:** CKEditor rejects plain DOM edits — a naive range
  replacement is reverted by its model. The replacement path
  ([Input.tsx](source/ContentScript/Input.tsx), `isCkEditor` branch in
  `updateTextWithAlternative`) instead dispatches a synthetic `Delete` keydown
  followed by a synthetic `paste` `ClipboardEvent` carrying the alternative,
  with ~200 ms settling pauses so CKEditor's pipeline processes each step.
  CKEditor is also in `requiresRectRecalculation` — its editable's rect must
  be re-read at positioning time.
- **Testing quirks** (see [__tests__/fixtures/ckeditor.html](__tests__/fixtures/ckeditor.html)):
  - The UMD build needs `licenseKey: 'GPL'` (CKEditor 5 v44+).
  - Anything set directly on the editable's DOM element (like an `id`) is
    wiped on the next render — CKEditor owns those attributes. Set them
    through `editor.editing.view.change(writer => …)`.
  - A click into the editable focuses it but leaves the DOM caret at offset 0
    unless it lands exactly on the paragraph — which is why the test helper
    measures word positions from the text node via a DOM Range instead of
    font arithmetic.

### Quill — supported (generic path), covered by tests

- **Detection:** none needed; `.ql-editor` is a plain contenteditable.
- Replacement lands through the generic Range path and Quill's
  MutationObserver absorbs it into its Delta model. No known issues.
- Fixture: [__tests__/fixtures/quill.html](__tests__/fixtures/quill.html).

### TinyMCE — inline mode only, covered by tests

- **Detection:** `isTinyMceEditor` matches `#tinymce` (the body id inside the
  classic-mode iframe) but is only referenced in commented-out code — TinyMCE
  effectively runs as generic contenteditable.
- **Classic (iframe) mode is unsupported:** TinyMCE edits inside an
  `about:blank` iframe, and the manifest's content scripts declare no
  `match_about_blank`, so the extension is never injected there. Only
  *inline* mode (editing the host element directly) works. Greenhouse embeds
  TinyMCE and has its own canvas-height workaround
  (`getGreenhouseHeight` in [highlightsUtils.tsx](source/ContentScript/highlightsUtils.tsx)).
- Fixture: [__tests__/fixtures/tinymce.html](__tests__/fixtures/tinymce.html)
  (inline mode, `license_key: 'gpl'` for TinyMCE 7+).

### Froala / Redactor / AEM RTE — special-cased, untested

- Froala (`.fr-element`/`.fr-view`) and Redactor (`.redactor_html-editor`)
  only get z-index adjustments for the highlight overlay (`getZIndex`).
- AEM RTE (`#CQrte`) is accepted on focusin (with a guard against anchor
  tags) and gets a scroll offset in canvas positioning.
- None of these are in the test suite — both Froala and Redactor are
  commercial, so local fixtures would need licenses.

## Google Docs — heaviest special case, live-tested only

Google Docs does not use contenteditable for the document: text is drawn onto
the **kix canvas**, and keystrokes go through a hidden `about:blank` iframe
(`.docs-texteventtarget-iframe`).

- **Detection:** URL-based (`isGoogleDocs`, `docs.google.com/document`).
- **Bootstrapping:** there is no focusin from the canvas; the extension binds
  once to `.kix-rotatingtilemanager`
  ([ContentScriptApp.tsx](source/ContentScript/ContentScriptApp.tsx)).
- **Reading text:** a MAIN-world script (`assets/googleDocsSupport.js`,
  injected at `document_start` via the manifest) plus a `GoogleDocsClone`
  component that mirrors the canvas pages into measurable DOM.
- **Replacement:** simulated mouse events select the target text on the
  canvas, then a synthetic paste inserts the alternative.
- **Positioning:** icon is position-fixed; highlight x-offset depends on
  whether the vertical ruler is hidden; canvas is capped at ~2 pages height.
- **Comment/reply boxes** are ordinary contenteditables. Historically the
  extension ignored them entirely (no focusin listener on Docs pages) and
  would have misrouted them into kix logic — issue #1078; fixed by
  parameterizing `isGoogleDocs(element)` to answer false for
  contenteditables. Since the fix they get the full generic treatment,
  including the keyboard-operable popover.
- **Keyboard shortcut limitation:** the open-popover shortcut
  (`open-highlight-popover`, see [source/manifest.json](source/manifest.json))
  cannot open the popover on the *main document*. The content script's
  handler only reacts when the focused element is inside the input it is
  bound to, but on Docs focus lives inside the hidden
  `.docs-texteventtarget-iframe` — never inside the kix tile manager the
  extension binds to. Comment boxes are unaffected (they hold focus
  themselves).
- **Testing:** cannot be fixtured — kix only exists on docs.google.com. The
  live smoke test ([__tests__/gdocs.spec.js](__tests__/gdocs.spec.js)) drives
  a real world-editable scratch doc whose URL lives in the gitignored
  `__tests__/local.config.json` (template: `local.config.json.example`); the
  suite skips itself when that file is absent (e.g. CI). Highlight assertions
  must be scoped to canvases under the extension's `ww-*` elements, because
  the document itself is a canvas and would false-positive any global
  painted-pixels check.

## Site-specific handling (not editors per se)

| Site | Handling |
|------|----------|
| Microsoft Online (Word/Excel/PowerPoint, Outlook 365, Sharepoint) | **Currently disabled entirely** — `ContentScriptApp` returns early on these URLs ("needed in addition to the deny list because of iframes"). The Word/Outlook/Excel-formula-bar branches further down are dead code until that early return is lifted. |
| Notion | Input is retargeted to the page's `main` element; keyup listeners attach to `.notion-frame`. |
| LinkedIn | Alerts whose text contains `#` are skipped (hashtag false positives). |
| Gmail / Hubspot | Canvas height and scroll-expansion workarounds; Gmail also gets a spellcheck-suppression stylesheet via the manifest. |
| Greenhouse / Typo3 | Highlight positioning accounts for the editor living in a same-origin iframe (`iframePositionRecquired`). |
| ChatGPT | `DEV_ENV`-only experiment targeting `.markdown` output nodes. |
| Google Search / Google Sheets | Content script exits early / detection used to skip document-specific logic (Sheets still works as of issue #1078 discussion). |
| Trello, BambooHR, ModX, Recruitee, personio.de | z-index and rect-recalculation special cases only. |

## Test coverage summary

| Editor | Fixture | Highlights | Popover | Apply alternative |
|--------|---------|-----------|---------|-------------------|
| textarea | `textarea.html` | ✅ (+ snapshots) | ✅ | ✅ (via popover/a11y specs) |
| contenteditable | `contenteditable.html` | ✅ | – | – |
| CKEditor 5 | `ckeditor.html` | ✅ | ✅ | ✅ |
| Quill | `quill.html` | ✅ | ✅ | ✅ |
| TinyMCE (inline) | `tinymce.html` | ✅ | ✅ | ✅ |
| Google Docs | live doc (local-only) | ✅ | – | – |

The editor packages are devDependencies served by the fixture server under
`/vendor/` ([__tests__/fixtures/server.js](__tests__/fixtures/server.js)) —
test contexts block every non-localhost request, so CDN copies can never load.

## Adding a new editor fixture

1. `npm install --save-dev <editor>` and serve its dist bundle from
   `/vendor/<pkg>/…` (the server maps that prefix onto `node_modules`).
2. Create `__tests__/fixtures/<editor>.html`: init the editor, give the
   editable element `id="editor"` (through the editor's own API if it manages
   DOM attributes — see the CKEditor note), and set
   `window.__editorReady = true` when initialization finishes.
3. Add the editor to the `EDITORS` table in
   [__tests__/editors.spec.js](__tests__/editors.spec.js); the three shared
   tests (highlights / popover / apply) run automatically.
4. If applying an alternative doesn't stick, the editor probably reverts
   foreign DOM edits — it needs a dedicated replacement branch in
   `updateTextWithAlternative` like CKEditor's.
