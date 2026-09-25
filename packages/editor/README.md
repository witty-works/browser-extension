# @witty-works/editor

[Witty](https://witty.works)'s inclusive-language checker as an embeddable rich-text editor. It checks as you type, underlines what Witty flags, and offers alternatives in the same popover as the Witty browser extension. It includes a formatting toolbar and Witty's settings (categories, gender formats, spelling, AI suggestions).

One self-contained script: no framework, no stylesheet to include. As a script tag or as an ES module for bundlers, with TypeScript types.

## Usage

### Script tag

```html
<div id="editor"></div>
<script src="https://cdn.jsdelivr.net/npm/@witty-works/editor@2.6.1/dist/witty-editor.js"></script>
<script>
  const editor = WittyEditor.mount(document.getElementById('editor'), {
    endpoint: 'https://your-nlp-api.example/',
    onStatus: (status) => console.log(status),
  });
  // The key stays in memory and is sent only as the x-key header.
  editor.setApiKey(keyFromYourBackend);
</script>
```

Pin an exact version, as above, rather than a range: the script runs with access to the page. Or `npm install @witty-works/editor` and serve `node_modules/@witty-works/editor/dist/witty-editor.js` yourself. Releases are published from CI with npm provenance.

### With a bundler

```bash
npm install @witty-works/editor
```

```ts
import {mount, type EditorStatus} from '@witty-works/editor';

const editor = mount(document.getElementById('editor')!, {
  endpoint: 'https://your-nlp-api.example/',
  onStatus: (status: EditorStatus) => console.log(status),
});
editor.setApiKey(keyFromYourBackend);
```

The package's main entry is an ES module (`dist/witty-editor.mjs`) exporting `mount`, with types (`dist/witty-editor.d.ts`) for the options, the handle, `onStatus` and the settings: `MountOptions`, `WittyEditorHandle`, `EditorStatus`, `EditorSettings`, `CheckConfig`, `CheckLang`, `GenderFormatSwitchResult` and the rest. It works like the script: the same editor, React, TipTap and styles included (injected when the module is imported), nothing to configure in the bundler. It is not minified; your bundler does that. It does not share your page's React, so a React app loads a second copy for the editor.

The type of the handle's `editor` property comes from TipTap: install `@tiptap/core` (version 3, an optional peer dependency) if you use it from TypeScript. Nothing else needs it.

For the script tag in a TypeScript project, the same types describe the global: `declare const WittyEditor: typeof import('@witty-works/editor');`.

## `WittyEditor.mount(element, options)`

| Option | Default | |
|---|---|---|
| `endpoint` | page origin | NLP API base URL; a relative one resolves against the page, and a missing trailing slash is added. Anything but an `http(s)` URL throws a `TypeError` |
| `apiKey` | none | Sent as `x-key`; prefer `setApiKey` |
| `lang` | `'auto'` | Text language: `auto`, `en`, `de`, `fr` or a variant such as `de-CH` |
| `config` | none | Check config (gender formats, disabled categories, …); only fields you set are sent |
| `content` | empty | Initial content as HTML |
| `label` | `'Text to check'` | Accessible name of the editable area |
| `describedBy` | none | Ids of elements that further describe the editable area, separated by spaces; added to its `aria-describedby` after the editor's own hint |
| `toolbar` | `true` | Formatting toolbar with the Witty menu (see below) |
| `llmAlternatives` | `false` | Offer AI sentence rewrites in the popover |
| `llmTimeoutMs` | `3000` | How long to wait for them; raise it for a local model |
| `delay` | `500` | Debounce after the last edit, in ms |
| `maxRequestLength` | `1000` | Characters per check request; set it to the API's `TEXT_MAX_LENGTH` if that differs (see Long texts) |
| `maxTextLength` | `20000` | Characters of the text checked at all |
| `installationId` | random per editor | Opaque id sent with each check, as the extension sends its installation id; it only ends up in the API's request logs. Pass a stable one to tell installations apart across page loads, never personal data |
| `onStatus` | none | The check's state (see Status and errors) |
| `onSettingsChange` | none | Called with the settings when the user changes one, e.g. to store them |

It returns a handle:

- `setApiKey(key)`: replace the API key and check again.
- `setConfig(config)`: replace the whole check config (no merging) and check again; `{}` sends none. The same config again changes nothing, so a host can pass its config on every render. The editor keeps a copy: changing the object afterwards has no effect.
- `updateSettings(settings)`: change settings from the host, e.g. its own form, as the settings panel does (the panel follows). The fields given replace the current ones and the rest stay: `updateSettings({llmAlternatives: true})`, `updateSettings({orthography: false})`. `config`, when given, is replaced whole, as with `setConfig`; to change one field of it, start from `getSettings().config`. Calls `onSettingsChange` once if anything changed, and nothing happens if nothing did. A changed `config` checks the text again; popovers opened afterwards follow `llmAlternatives`, an open one keeps what it shows. A value of the wrong type (`llmAlternatives: 'false'`, a `config` that is not an object) throws a `TypeError` and changes nothing. Unlike `setConfig`, which is for the host's own changes, this reports to `onSettingsChange`, so a host that stores the settings there sees changes from its form and from the panel alike.
- `getSettings()`: the current settings, `{config, llmAlternatives, orthography}`, as a copy; the same object `onSettingsChange` receives.
- `getText()`: the document as plain text.
- `switchGenderFormat(target)`: rewrite the text into a German or French gender format, as the menu does (see below); `target` is a `german_gender_ending` or `french_gender_separator` value. Resolves with `{outcome, target, count, limitReached}`; `outcome` is `switched`, `nothing`, `fromInklusivum` (nothing switched, and the text was in the Inklusivum, which the API cannot convert out of yet), `disabled` (the account keeps these alerts off), `forced` (the account forces another format, given as `applied`; nothing is changed), `unsupported` (the API cannot switch to this target yet) or `unavailable` (not a gender format). Rejects if the switch's check fails (e.g. a refused key or a timeout; the previous settings are restored and nothing is rewritten) or the editor is destroyed meanwhile (an error named `EditorDestroyedError`).
- `editor`: the underlying [TipTap](https://tiptap.dev) editor.
- `destroy()`: remove the editor and everything it added to the page. A switch still running rejects.

## Status and errors

`onStatus` receives:

| Status | When | Alerts |
|---|---|---|
| `{state: 'idle', alerts, limitReached}` | A check finished; after a gender format switch it also has `genderFormatSwitch` | Shown |
| `{state: 'unauthorized'}` | The API refused the key (401) or the token behind it (403) | Cleared |
| `{state: 'outdated', message}` | The API no longer supports this editor version (400); `message` is the API's explanation. The page needs to load a newer version | Cleared |
| `{state: 'unsupportedLanguage'}` | The API could not tell the text's language (422) | Cleared |
| `{state: 'error', message}` | Anything else, e.g. the API is unreachable, answered 5xx, or gave no answer within 30 seconds | Kept until the next check |

The W icon and the live region say the same to the user. Checks send `client: "witty-editor:<version>"`, so the API can require a minimum version for the editor separately from the browser extension (`web-ext`).

## The Witty menu

The W icon at the end of the toolbar shows whether Witty is checking, and opens a menu (a keyboard-operable ARIA menu: arrow keys, Home and End move, Escape closes and returns focus to the icon):

- **Settings…**: Witty's categories and preferences, as in the browser extension.
- **Switch gender format…**: rewrites every gendered form in the text into another format, labelled as in the settings (see [Switching the gender format](#switching-the-gender-format)).
- **Help** and **About**: the Witty Works help on the editor and the website, in a new tab.

### Switching the gender format

The formats offered depend on the text's language:

- **German:** the eight separator formats (`/in`, `/-in`, `_in`, `*in`, `:in`, `(-)`, `()`, `In`) and the Inklusivum (`de-e`).
- **French:** the six separator formats `·` (`enseignant·es`), `·s` (`enseignant·e·s`), `.`, `.s`, `/` and `/s`.

The language is the one the host fixed with `lang`, or else what the API detected. A text with both German and French gets both groups, headed "German" and "French", the language of most of the text first; a text in neither (or not checked yet) gets both too. The API detects one language per request, and a short text goes in one request, so a short text mixing both languages is taken as the language of most of it; only longer texts, checked in several requests, show both groups.

A switch sets the target in its language's field (`german_gender_ending` or `french_gender_separator`) and leaves the other language's alone. It rewrites, as far as the API marks them:

- forms in another format: `Lehrer*innen` → `Lehrer:innen`, `enseignant.e.s` → `enseignant·es`, and the articles and short endings that go with them (`die*der`, `jede/-r`, `la·le`, `un·e`);
- roles in the generic masculine: `Der Lehrer` → `Die:der Lehrer:in`, `le directeur` → `la·le responsable`;
- pair formulas and doublets, as a whole: `Schüler und Schülerinnen` → `Schüler:innen`, `les enseignantes et les enseignants` → `les enseignant·es`.

In a mixed text, a switch applies only alerts in its own language (the result's `language`, or its request's), so switching the French format never touches the German text.

**The Inklusivum.** Switching into it declines nouns for number and case (`Lehrer*innen` → `Lehrerne`, `den Schüler:innen` → `den Schülernen`) and converts articles (`die*der` → `de`, `jede/-r` → `jedey`). It leaves as written what the API cannot convert: compounds (`Mitarbeiter*innenbefragung`), nouns missing from its lexicon, and nouns whose case it cannot tell. So a switch into the Inklusivum can be partial even when the whole text was checked. Switching out of the Inklusivum is not supported by the API yet: a switch from a text in the Inklusivum finds nothing, and the editor says so (outcome `fromInklusivum`) rather than "nothing to switch".

**API versions.** French and the Inklusivum need API versions that support them (NLP API PR #1247 for French, the Inklusivum branch stacked on it). Before those are deployed, the API answers a French or Inklusivum switch with `bulk_actions: []`; the editor then reports the target as not supported by the server yet and marks it so in the panel for the rest of the session. It reads this from the API rather than hard-coding which targets work.

A switch makes the chosen format the configured one, waits until the whole text has been checked (every batch of a long text), and then applies all alerts the API marked with `bulk: "gender_format"` in one transaction, so a single undo restores the text. The result is announced once, in the editor's live region, and passed to `onStatus` as `genderFormatSwitch`; `count` includes the gendered masculines. If only part of the text was checked (`limitReached`), what was checked is switched and the message says so.

The switch's checks ask for the gender-format alerts even where the account turned them off: `gendered_denominations_ending_advanced` is taken out of `disabled_categories` and `gendered_roles_format` is `inclusive_gender`, for those requests only; the user's settings stay as they are. If the API still sends none, because the account's stored configuration forces them off, the editor says "Switching the gender format is turned off for this account". For French and the Inklusivum it cannot tell that case from an API that does not support the target yet (both answer `bulk_actions: []`), and says the latter.

An organisation or user config can also force the gender format. The API then converts towards the forced format, whatever the request asks for, so the editor compares the check response's `gender_separator` with the chosen format first, for the requests in the switched language. If they differ, it changes nothing, keeps the previous setting, and says which format the organisation sets (outcome `forced`).

### The `bulk` contract

The editor decides what to apply by `bulk` alone, never by subcategory:

- A check result with `bulk: "gender_format"` belongs to the switch to the configured format of its language (`german_gender_ending` or `french_gender_separator`): a form in another format, a role in the generic masculine, or a pair formula or doublet the API recognises.
- `bulk_alternative` is the index into its `alternatives` of the one the switch applies. The editor applies `alternatives[bulk_alternative]` when the index is an integer within range and that alternative has a `text`, and skips the result otherwise.
- Without `bulk_alternative` (API versions before it), a result is applied only if it has exactly one alternative, which is then the form in the target format.
- Such results never overlap, and applying all of them in any order gives the same text.
- Feminine forms, address forms, pronouns and pair formulas the API didn't recognise are left out by the API on purpose; the editor applies nothing it isn't marked for.
- `bulk` is absent (or `null`) on every other result. Unknown `bulk` values are ignored.
- Every check response lists the groups the request can return in `bulk_actions`, whether or not a result does: `["gender_format"]` for German (with any format, the Inklusivum included) and for French, with inclusive roles and the gender-format alerts on; `[]` otherwise, and for French and the Inklusivum on API versions that cannot switch there. After the switch's check, a list without `"gender_format"` means the account keeps the switch off, or, for French and the Inklusivum, that the API cannot switch there yet.
- `gender_separator` in the check response is the format the API applied in the request's language: a `german_gender_ending` value for German, a `french_gender_separator` value for French.

Switching needs an NLP API that sends `bulk_actions`; releases up to 2.4.8 do not. With those, the editor falls back to guessing from the results: gender-format results without `bulk` mean the server doesn't support switching yet, and the menu entry says so.

## Long texts

The NLP API checks at most `TEXT_MAX_LENGTH` characters per request (1000 by default). The editor checks longer texts sentence by sentence, as the browser extension does: it sends the sentences it has not checked yet, in requests of up to `maxRequestLength` characters, and caches the results, so after an edit only the changed sentence is sent again. If the API cuts a request short anyway, that batch is sent again in smaller pieces.

Part of a text can stay unchecked: anything past `maxTextLength`, or a single sentence longer than the API checks at once. `onStatus` then reports `limitReached: true`, and the editor shows "Only part of this text was checked." under the text.

## Requirements

- **Content-Security-Policy:**
  - `script-src` must allow the script, and `style-src` inline styles: the editor injects its own `<style>`.
  - `img-src data:` for the popover's logo, which is inline.
  - `img-src https://www.witty.works` for the pictures in the explanations ("learning bites").
  - `connect-src` for the API endpoint's origin, when it differs from the page's.
- **CORS:** the NLP API must allow the page's origin.

## Settings from the host: what to keep in mind

- **The switches are not access control.** Anything running in the page can call the handle, and a user can from the browser console. So `llmAlternatives: false` is a default, not a limit. Who may use the LLM at all is the NLP API's decision (`LLM_ACCESS` and its allow list, and whether clients may ask for it, `CLIENT_CONFIG_ENABLED`); how many requests they make is not limited by the API, so a deployment that has to ration them needs a rate limit in front of it. The same goes for everything in `config`: an organisation's forced settings are applied by the API, whatever the editor sends.
- **Keep the handle to yourself.** Don't put it on `window`; any script on the page could then change settings or read the text. The API key can only be set through it, never read back.
- **Settings hold no secrets.** `getSettings()` and `onSettingsChange` never include the API key, so hosts can store the settings, e.g. per user.
- **Spelling and the browser.** `orthography: false` lets the browser's own spellcheck underline the text again. Some browsers' enhanced spellcheck (Chrome, Edge) sends the text to the vendor's service; with `orthography: true` (the default) the editor turns the browser's spellcheck off.

## Storage

The API key is kept in memory only; it is never written to the page, to cookies or to storage. The only thing the editor stores is i18next's language cache, `localStorage["i18nextLng"]`.

## License

MIT. The bundle includes third-party software (React, TipTap, ProseMirror, i18next and others); their license notices are in `dist/witty-editor.js.LICENSE.txt`. Serve or ship that file alongside the script.
