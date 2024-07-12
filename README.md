# Witty Browser Extension (formerly known as Inclusifier)

## Requirements to start

- [Node.js](https://nodejs.org) 18+
- [npm](https://www.npmjs.com/)

# Get the code

Clone repo `git clone https://github.com/witty-works/browser-extension.git`

## Preparing the project

Go to project directory `cd browser-extension`

Ensure you are using node 18+

Run `npm install` to install dependencies.

## Development

From inside the directory, start the development server depending on the browser you are using

- Chrome: `npm run dev:chrome`
- Firefox: `npm run dev:firefox`
- Opera: `npm run dev:opera`

This will run in the background, watching for changes and rebuilding the project automatically.

## Building for production

You can several options:

- `npm run build:chrome` to build chrome extension
- `npm run build:firefox` to build firefox addon
- `npm run build:opera` to build opera extension
- `npm run build` builds and packs extensions all at once to `extension/BROWSER` directory respectively.

**Note:** By default the `manifest.json` is set with version `0.0.0`. The webpack loader will update the version in the build with that of the `package.json` version. In order to release a new version, update version in `package.json` and run script.

If you don't want to use `package.json` version, you can disable the option [here](https://github.com/abhijithvijayan/web-extension-starter/blob/e10158c4a49948dea9fdca06592876d9ca04e028/webpack.config.js#L79).

## Load the extension in the browser

Either you run the Development or Production scripts, it is build inside `extension/BROWSER` folder. Just follow the different instructions depending on the browser

### Chrome

- Go to the browser address bar and type `chrome://extensions`
- Check the `Developer Mode` button to enable it.
- Click on the `Load Unpacked Extension…` button.
- Select your extension’s extracted directory.

### Firefox

- Load the Add-on via `about:debugging` as temporary Add-on.
- Choose the `manifest.json` file in the extracted directory

### Opera

- Load the extension via `opera:extensions`
- Check the `Developer Mode` and load as unpacked from extension’s extracted directory.

## Generating browser specific manifest.json

Update `source/manifest.json` file with browser vendor prefixed manifest keys

```js
{
  "__chrome__name": "SuperChrome",
  "__firefox__name": "SuperFox",
  "__edge__name": "SuperEdge",
  "__opera__name": "SuperOpera"
}
```

if the vendor is `chrome` this compiles to:

```js
{
  "name": "SuperChrome",
}
```

---

Add keys to multiple vendors by separating them with | in the prefix

```
{
  __chrome|opera__name: "SuperBlink"
}
```

if the vendor is `chrome` or `opera`, this compiles to:

```
{
  "name": "SuperBlink"
}
```

See the original [README](https://github.com/abhijithvijayan/wext-manifest-loader) of `wext-manifest-loader` package for more details

## Unit Testing
run `npx playwright install-deps`
run `npx playwright install`
Copy `.env.example` to `.env` and adjust the values accordingly.

```
PREMIUM_TEST_USER_EMAIL = 'witty.works.premium.user@gmail.com'
PREMIUM_TEST_USER_PASSWORD = '<can be found in 1Password>'
HTACCESS_USERNAME = 'witty'
HTACCESS_PASSWORD = '<can be found in 1Password>'
```

To run locally: From inside the directory just run `npm run test` (runs in linux environment)
You can watch the tests executing on http://localhost:6080/  (PW: vscode)

test-results folder will be created with screenshots for manual debuging

## Update Screenshots

### Step 1: Download Test Results
First, download the `test-results` folder, which is produced during runtime. You can find this under the **Artifacts** section in the **Summary** of the failing test.

### Step 2: Compare Screenshots
Next, compare the actual screenshot with the expected one to identify any discrepancies.

### Step 3: Update Repository
If the actual screenshot is now correct, follow these steps to update the repository:
- Upload the correct screenshot to the `__tests__/highlightPlacement.spec.js-snapshots` directory in this repository.

### Step 4: Manage Old Screenshots
- Delete the original screenshots:
  - `Highlights-witty-form-not-logged-in-1-linux.png`
  - `Highlights-witty-form-1-linux.png`
- Rename the new screenshots to match the names of the originals.

## Linting & TypeScript Config

- Shared Eslint & Prettier Configuration - [`@abhijithvijayan/eslint-config`](https://www.npmjs.com/package/@abhijithvijayan/eslint-config)
- Shared TypeScript Configuration - [`@abhijithvijayan/tsconfig`](https://www.npmjs.com/package/@abhijithvijayan/tsconfig)

## License

This is a fork of [Web Extension Browser](https://github.com/abhijithvijayan/web-extension-starter/) by [Abhijith Vijayan](https://abhijithvijayan.in) under MIT license.

## Testing Guidelines for Frequent Functionalities (Applicable to Textarea and Contenteditable)

### Testing Highlight Functionality 

After making changes to highlights:
- Ensure highlights scroll correctly within the scrolling text area.
- Verify highlights stay fixed when scrolling the surrounding window.
- Check that highlights maintain their position.
- Ensure highlights above text remain fixed while the highlights below are removed and then re-added in the correct position.
- For long text, ensure only the first set number of characters are sent to the API. Users should be able to highlight additional text by clicking on a paragraph.
- Note that much of the Google Docs compatibility code is separate and also needs updates.
- Confirm that no highlights are displayed when the user is not logged in or if the trial has expired.
- Verify that highlights adapt when resizing the input window as well as when resizing the entire window.

### Testing Popover Functionality

After making changes to popover:
- Ensure the popover opens and closes correctly when clicking a word.
- Verify the correct popover is displayed based on user status (not logged in, needs upgrade, logged in).
- Check that the position of the popover is accurate relative to the selected word.
- Confirm that learning bites are loaded correctly.
- Verify that alternatives are inserted correctly, with specific attention to 'remove' alternatives.
- Test the functionality of ignoring a word once and ignoring a word permanently through dashboards.

### Testing Popup Functionality

After making changes to popup:
- Verify enabling and disabling the extension functions correctly:
  - Ensure that when the extension is disabled, neither the 'witty active' nor 'witty passive' icons appear anywhere.
  - Confirm no 'ww-container' elements are in the DOM.
  - Pay extra attention to the behavior with iframes and when multiple input fields are on a page.
- Ensure the correct popup is shown in appropriate situations (not logged in, domain disabled, no subscription, valid subscription).


## Common Compatibility Issues and Resolutions

### Highlight Visibility Issues

- **Highlights Do Not Appear**: Check `getZIndex` in `Highlights.tsx` for issues related to z-index or stacking contexts.
- **Witty Does Not Load**: Investigate the target element detected in `handleFocusinElement` in `ContentScriptApp.tsx`. The issue may involve incorrect targeting of parent, child, or unrelated elements.
- **Highlights Displaced**: Commonly related to `canvasSize`, `correctedPosition`, or `rangeRects` positions in `Highlights.tsx`.
- **Google Docs and Text Area Displaced Highlights**: Ensure correct styling is applied in `GoogleDocsClone.tsx` and `TextAreaClone.tsx`.

### Scrolling and Insertion Issues

- **Scrolling Displaces Highlights**: Typically involves issues with `correctedPosition.top` in the `canvasSize` or `elementScroll` in `Input.tsx`.
- **Alternatives Cannot Be Inserted**: Explore different methods provided in `updateTextWithAlternative` in `Input.tsx`.

### Functionality and Styling Issues

- **Enabling/Disabling Witty Not Functioning**: Often a problem with how the domain is stored or accessed, especially within iframe domains.
- **CSS Conflicts**: Ensure that CSS classes are properly namespaced to avoid conflicts.


