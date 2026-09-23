# @witty-works/editor

[Witty](https://witty.works)'s inclusive-language checker as an embeddable rich-text editor. It checks as you type, underlines what Witty flags, and offers alternatives in the same popover as the Witty browser extension. It includes a formatting toolbar and Witty's settings (categories, gender formats, spelling, AI suggestions).

One self-contained script: no framework, no stylesheet to include.

## Usage

```html
<div id="editor"></div>
<script src="https://cdn.jsdelivr.net/npm/@witty-works/editor@2.1.0/dist/witty-editor.js"></script>
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

## `WittyEditor.mount(element, options)`

| Option | Default | |
|---|---|---|
| `endpoint` | page origin | NLP API base URL, with trailing slash |
| `apiKey` | none | Sent as `x-key`; prefer `setApiKey` |
| `lang` | `'auto'` | Text language: `auto`, `en`, `de`, `fr` or a variant such as `de-CH` |
| `config` | none | Check config (gender formats, disabled categories, …); only fields you set are sent |
| `content` | empty | Initial content as HTML |
| `label` | `'Text to check'` | Accessible name of the editable area |
| `describedBy` | none | Ids of elements that further describe the editable area, separated by spaces; added to its `aria-describedby` after the editor's own hint |
| `toolbar` | `true` | Formatting toolbar with the Witty settings button |
| `llmAlternatives` | `false` | Offer AI sentence rewrites in the popover |
| `llmTimeoutMs` | `3000` | How long to wait for them; raise it for a local model |
| `delay` | `500` | Debounce after the last edit, in ms |
| `maxRequestLength` | `1000` | Characters per check request; set it to the API's `TEXT_MAX_LENGTH` if that differs (see Long texts) |
| `maxTextLength` | `20000` | Characters of the text checked at all |
| `onStatus` | none | `{state: 'idle', alerts, limitReached}`, `{state: 'unauthorized'}` or `{state: 'error', message}` |
| `onSettingsChange` | none | Called with the settings when the user changes one, e.g. to store them |

It returns a handle:

- `setApiKey(key)`: replace the API key and check again.
- `setConfig(config)`: replace the whole check config (no merging) and check again; `{}` sends none.
- `getSettings()`: the current settings, `{config, llmAlternatives, orthography}`, as a copy; the same object `onSettingsChange` receives.
- `getText()`: the document as plain text.
- `editor`: the underlying [TipTap](https://tiptap.dev) editor.
- `destroy()`: remove the editor and everything it added to the page.

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

## Storage

The API key is kept in memory only; it is never written to the page, to cookies or to storage. The only thing the editor stores is i18next's language cache, `localStorage["i18nextLng"]`.

## License

MIT. The bundle includes third-party software (React, TipTap, ProseMirror, i18next and others); their license notices are in `dist/witty-editor.js.LICENSE.txt`. Serve or ship that file alongside the script.
