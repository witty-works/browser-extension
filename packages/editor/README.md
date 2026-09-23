# @witty-works/editor

[Witty](https://witty.works)'s inclusive-language checker as an embeddable rich-text editor. It checks as you type, underlines what Witty flags, and offers alternatives in the same popover as the Witty browser extension. It includes a formatting toolbar and Witty's settings (categories, gender formats, spelling, AI suggestions).

One self-contained script: no framework, no stylesheet to include.

## Usage

```html
<div id="editor"></div>
<script src="https://cdn.jsdelivr.net/npm/@witty-works/editor@0.1.0/dist/witty-editor.js"></script>
<script>
  const editor = WittyEditor.mount(document.getElementById('editor'), {
    endpoint: 'https://your-nlp-api.example/',
    onStatus: (status) => console.log(status),
  });
  // The key stays in memory and is sent only as the x-key header.
  editor.setApiKey(keyFromYourBackend);
</script>
```

Or `npm install @witty-works/editor` and serve `node_modules/@witty-works/editor/dist/witty-editor.js` yourself.

## `WittyEditor.mount(element, options)`

| Option | Default | |
|---|---|---|
| `endpoint` | page origin | NLP API base URL, with trailing slash |
| `apiKey` | none | Sent as `x-key`; prefer `setApiKey` |
| `lang` | `'auto'` | Text language: `auto`, `en`, `de`, `fr` or a variant such as `de-CH` |
| `config` | none | Check config (gender formats, disabled categories, …); only fields you set are sent |
| `content` | empty | Initial content as HTML |
| `label` | `'Text to check'` | Accessible name of the editable area |
| `toolbar` | `true` | Formatting toolbar with the Witty settings button |
| `llmAlternatives` | `false` | Offer AI sentence rewrites in the popover |
| `llmTimeoutMs` | `3000` | How long to wait for them; raise it for a local model |
| `delay` | `500` | Debounce after the last edit, in ms |
| `onStatus` | none | `{state: 'idle', alerts}`, `{state: 'unauthorized'}` or `{state: 'error', message}` |
| `onSettingsChange` | none | Called when the user changes a setting, e.g. to store it |

It returns a handle:

- `setApiKey(key)`: replace the API key and check again.
- `setConfig(config)`: replace the whole check config (no merging) and check again; `{}` sends none.
- `getText()`: the document as plain text.
- `editor`: the underlying [TipTap](https://tiptap.dev) editor.
- `destroy()`: remove the editor and everything it added to the page.

## Requirements

- The page's Content-Security-Policy must allow the script and inline styles: the editor injects its own `<style>`.
- The NLP API must allow the page's origin (CORS).

## License

MIT
