/**
 * Ambient declarations for the build-time constants webpack substitutes into the
 * bundle via `webpack.EnvironmentPlugin` (see webpack.config.js). These are
 * inlined as string literals at build time, so `process` itself never exists
 * at runtime — only these lookups do.
 */
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production';
    TARGET_BROWSER: string;
    /** 'true' only in builds made for the Playwright suite. */
    TESTING: string;
    /** Client version sent to the API: the manifest version in the extension. */
    WITTY_VERSION: string;
    /**
     * The Sentry release errors are reported under, the same one the source
     * maps are uploaded to; set by webpack.config.js, extension only.
     */
    SENTRY_RELEASE: string;
  };
};
