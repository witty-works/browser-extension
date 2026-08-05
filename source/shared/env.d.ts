/**
 * Ambient declarations for the build-time constants webpack substitutes into the
 * bundle via `webpack.EnvironmentPlugin(['NODE_ENV', 'TARGET_BROWSER'])` (see
 * webpack.config.js). These are inlined as string literals at build time, so
 * `process` itself never exists at runtime — only these two lookups do.
 */
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production';
    TARGET_BROWSER: string;
    /** 'true' only in builds made for the Playwright suite. */
    TESTING: string;
  };
};
