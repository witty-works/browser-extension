# Witty Browser Extension (formerly known as Inclusifier)

## Requirements to start

- [Node.js](https://nodejs.org)
- [Yarn](https://yarnpkg.com) v1 or v2 installed

# Get the code

Clone repo `git clone https://github.com/witty-works/browser-extension.git`

## Preparing the project

Go to project directory `cd browser-extension`

Ensure you are using node 16.15.1.

Run `yarn install` to install dependencies.

## Development

From inside the directory, start the development server depending on the browser you are using

- Chrome: `yarn run dev:chrome`
- Firefox: `yarn run dev:firefox`
- Opera: `yarn run dev:opera`

This will run in the background, watching for changes and rebuilding the project automatically.

## Building for production

You can several options:

- `yarn run build:chrome` to build chrome extension
- `yarn run build:firefox` to build firefox addon
- `yarn run build:opera` to build opera extension
- `yarn run build` builds and packs extensions all at once to `extension/BROWSER` directory respectively.

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

Copy `.env.example` to `.env` and adjust the values accordingly.

To run locally: From inside the directory just run `yarn run test`
To run with docker (needed to make linux screenshots for GA):
`docker run -v $PWD:/browser-extension -w /browser-extension --rm -it mcr.microsoft.com/playwright:v1.24.2-focal /bin/bash`

`xvfb-run yarn test`

test-results folder will be created with screenshots for manual debuging

## Linting & TypeScript Config

- Shared Eslint & Prettier Configuration - [`@abhijithvijayan/eslint-config`](https://www.npmjs.com/package/@abhijithvijayan/eslint-config)
- Shared TypeScript Configuration - [`@abhijithvijayan/tsconfig`](https://www.npmjs.com/package/@abhijithvijayan/tsconfig)

## License

This is a fork of [Web Extension Browser](https://github.com/abhijithvijayan/web-extension-starter/) by [Abhijith Vijayan](https://abhijithvijayan.in) under MIT license.
