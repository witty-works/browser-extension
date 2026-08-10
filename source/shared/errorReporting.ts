import {DEV_ENV} from './constants';

/**
 * Error-reporting seam (EDITOR_COMPONENT_PLAN.md, Phase 1 item 3).
 *
 * `shared/` code needs to report unexpected errors, but must not hard-couple
 * itself to Sentry or our DSN — a future `<witty-editor>` consumer, or a test
 * harness, has no business pulling in `@sentry/react`. Entry points that
 * already call `Sentry.init` (Background, ContentScript) register the real
 * reporter via `registerErrorReporter`; everything else falls back to logging
 * to the console in development and doing nothing in production, which is
 * close to what an uninitialized Sentry client did before this seam existed.
 */
export type ErrorReporter = (error: unknown) => void;

let reporter: ErrorReporter | null = null;

/**
 * Register the reporter that `reportError` delegates to. Call this once, at
 * bundle start-up, from whichever entry point owns the real implementation
 * (Sentry today; a host-supplied callback for an embedded component later).
 */
export const registerErrorReporter = (fn: ErrorReporter): void => {
  reporter = fn;
};

/** Report an error through the registered reporter, if any. */
export const reportError: ErrorReporter = (error) => {
  if (reporter) {
    reporter(error);
    return;
  }

  if (DEV_ENV) {
    console.error(error);
  }
};
