const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const FilemanagerPlugin = require('filemanager-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ExtReloader = require('webpack-ext-reloader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WextManifestWebpackPlugin = require('wext-manifest-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

const viewsPath = path.join(__dirname, 'views');
const sourcePath = path.join(__dirname, 'source');
const destPath = path.join(__dirname, 'extension');
const nodeEnv = process.env.NODE_ENV || 'development';
const targetBrowser = process.env.TARGET_BROWSER;

const extensionReloaderPlugin =
  nodeEnv === 'development'
    ? new ExtReloader({
        port: 9090,
        reloadPage: true,
        entries: {
          // TODO: reload manifest on update
          contentScript: 'contentScript',
          background: 'background',
          extensionPage: ['popup', 'options'],
        },
      })
    : () => {
        this.apply = () => {};
      };

const sentryWebpackPluginInstance =
  process.env.SENTRY_SOURCEMAPS &&
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_VERSION_STRING
    ? sentryWebpackPlugin({
        org: 'witty-works-ag',
        project: 'browser-extension',

        // Auth tokens can be obtained from https://sentry.io/settings/account/api/auth-tokens/
        // and need `project:releases` and `org:read` scopes
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: `${process.env.SENTRY_VERSION_STRING}-${targetBrowser}`,
        },
      })
    : () => {
        this.apply = () => {};
      };

/**
 * Static credentials in `source/witty.config.json` are a local-development and
 * CI convenience. `X_KEY` in particular is a *shared* API key, so anything it is
 * compiled into can be unpacked by whoever installs it. `source/shared/constants.ts`
 * already forces all three to empty in release builds, but silently neutering a
 * key someone believed was active is its own failure mode — fail loudly instead,
 * before anything is shipped.
 */
const assertNoBakedInCredentials = () => {
  if (nodeEnv !== 'production') {
    return;
  }

  const configPath = path.join(sourcePath, 'witty.config.json');
  if (!fs.existsSync(configPath)) {
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const offenders = ['X_KEY', 'ACCESS_TOKEN', 'REFRESH_TOKEN'].filter(
    (key) => typeof config[key] === 'string' && config[key].trim() !== ''
  );

  if (offenders.length > 0) {
    throw new Error(
      `Refusing to make a production build: ${offenders.join(', ')} ` +
        `${offenders.length === 1 ? 'is' : 'are'} set in source/witty.config.json. ` +
        `These are test/CI-only credentials and must never be compiled into a ` +
        `build that real users install. Clear them, or build with NODE_ENV=development.`
    );
  }
};

assertNoBakedInCredentials();

const getExtensionFileType = (browser) => {
  if (browser === 'opera') {
    return 'crx';
  }

  if (browser === 'firefox') {
    return 'xpi';
  }

  return 'zip';
};

module.exports = {
  devtool: 'source-map',

  stats: {
    all: false,
    builtAt: true,
    errors: true,
    hash: true,
  },

  mode: nodeEnv,

  entry: {
    manifest: path.join(sourcePath, 'manifest.json'),
    background: path.join(sourcePath, 'Background', 'index.tsx'),
    contentScript: path.join(sourcePath, 'ContentScript', 'index.tsx'),
    popup: path.join(sourcePath, 'Popup', 'index.tsx'),
    options: path.join(sourcePath, 'Options', 'index.tsx'),
  },

  output: {
    path: path.join(destPath, targetBrowser),
    filename: 'js/[name].bundle.js',
  },

  resolve: {
    fallback: {
      url: require.resolve('url/'),
    },
    extensions: ['.ts', '.tsx', '.js', '.json'],
    alias: {
      'webextension-polyfill': path.resolve(
        path.join(__dirname, 'node_modules', 'webextension-polyfill')
      ),
    },
  },

  module: {
    rules: [
      {
        type: 'javascript/auto', // prevent webpack handling json with its own loaders,
        test: /manifest\.json$/,
        use: {
          loader: 'wext-manifest-loader',
          options: {
            usePackageJSONVersion: false, // set to false to not use package.json version for manifest
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: '@svgr/webpack',
            options: { babel: false },
          },
        ],
      },
      {
        test: /\.(js|ts)x?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader, // It creates a CSS file per JS file which contains CSS
          },
          {
            loader: 'css-loader', // Takes the CSS files and returns the CSS with imports and url(...) for Webpack
            options: {
              url: false, //when set to true (default) things like "background-image: url("../assets/bkg/bkg-gradient.jpg")" fail...
              sourceMap: true,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  [
                    'autoprefixer',
                    {
                      // Options
                    },
                  ],
                ],
              },
            },
          },
          'resolve-url-loader', // Rewrites relative paths in url() statements
          'sass-loader', // Takes the Sass/SCSS file and compiles to the CSS
        ],
      },
    ],
  },

  plugins: [
    // Plugin to not generate js bundle for manifest entry
    new WextManifestWebpackPlugin(),
    // Generate sourcemaps
    new ForkTsCheckerWebpackPlugin(),
    // environmental variables
    new webpack.EnvironmentPlugin(['NODE_ENV', 'TARGET_BROWSER']),
    // TESTING is optional, so it gets a default rather than being required
    new webpack.EnvironmentPlugin({ TESTING: 'false' }),
    // delete previous build files
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.join(process.cwd(), `extension/${targetBrowser}`),
        path.join(
          process.cwd(),
          `extension/${targetBrowser}.${getExtensionFileType(targetBrowser)}`
        ),
      ],
      cleanStaleWebpackAssets: false,
      verbose: true,
    }),
    new HtmlWebpackPlugin({
      template: path.join(viewsPath, 'popup.html'),
      inject: 'body',
      chunks: ['popup'],
      hash: true,
      filename: 'popup.html',
    }),
    new HtmlWebpackPlugin({
      template: path.join(viewsPath, 'options.html'),
      inject: 'body',
      chunks: ['options'],
      hash: true,
      filename: 'options.html',
    }),
    // write css file(s) to build folder
    new MiniCssExtractPlugin({ filename: 'css/[name].css' }),
    // copy static assets
    new CopyWebpackPlugin({
      patterns: [{ from: 'source/assets', to: 'assets' }],
    }),
    // copy locales
    new CopyWebpackPlugin({
      patterns: [{ from: 'source/_locales', to: '_locales' }],
    }),
    // plugin to enable browser reloading in development mode
    extensionReloaderPlugin,
    sentryWebpackPluginInstance,
  ],

  optimization: {
    minimize: nodeEnv !== 'development',
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
      new FilemanagerPlugin({
        events: {
          onEnd: {
            archive: [
              {
                format: 'zip',
                source: path.join(destPath, targetBrowser),
                destination: `${path.join(destPath, targetBrowser)}.${getExtensionFileType(targetBrowser)}`,
                options: { zlib: { level: 6 } },
              },
            ],
          },
        },
      }),
    ],
  },
};
