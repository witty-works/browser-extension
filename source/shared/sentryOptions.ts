import type * as Sentry from '@sentry/react';

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type DataCollection = NonNullable<InitOptions['dataCollection']>;
type Integration = Extract<
  NonNullable<InitOptions['integrations']>,
  unknown[]
>[number];

/**
 * What Sentry may collect beyond the error itself: nothing about the user or
 * the requests around it.
 *
 * Sentry 11 replaced `sendDefaultPii` (off by default) with `dataCollection`,
 * whose defaults collect everything: the user's IP address, cookies, request
 * and response headers (ours carry the API key and the access token) and
 * bodies (a check request carries the text being checked), and URL query
 * parameters. Left unset, an error report from 2.7.0 on would have sent all of
 * that.
 *
 * `dataCollection` does not cover the page the error happened on. The content
 * script runs on every page the user visits, and Sentry still records that
 * page's address and the user's actions on it; `SENTRY_PRIVACY_OPTIONS` below
 * removes those.
 */
export const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
  // Only read by integrations this extension does not use; off so that adding
  // one cannot start collecting by default.
  graphQL: {document: false, variables: false},
  genAI: {inputs: false, outputs: false},
  mcp: {inputs: false, outputs: false},
  databaseQueryData: false,
  queues: false,
};

/**
 * Default integrations that record the page around an error.
 *
 * - `HttpContext` sets `event.request.url` to the address of the page (only
 *   the query is filtered), adds its Referer header, and writes the address
 *   onto every root span as `url.full`.
 * - `Breadcrumbs` records page navigations (old and new path), clicked and
 *   typed-into elements as CSS selectors, and the address of every fetch and
 *   XHR.
 * - `Console` records console messages, ours included, which can name the
 *   page or the domain.
 *
 * Left out rather than filtered in `beforeSend`: in the content script they
 * would otherwise wrap console, DOM events, fetch, XHR and history on every
 * page, only for us to throw away what they record.
 */
const PAGE_DATA_INTEGRATIONS = new Set([
  'HttpContext',
  'Breadcrumbs',
  'Console',
]);

/**
 * The `integrations` option: Sentry's defaults without those that record page
 * data, plus `extra`.
 */
export const sentryIntegrations =
  (extra: Integration[] = []) =>
  (defaults: Integration[]): Integration[] => [
    ...defaults.filter(
      (integration) => !PAGE_DATA_INTEGRATIONS.has(integration.name)
    ),
    ...extra,
  ];

/**
 * Remove the page's address and breadcrumbs from an event before it is sent.
 *
 * With the integrations above left out nothing should set either, so this is
 * the backstop for anything that still does: an integration added later, or a
 * breadcrumb added by hand.
 */
export const removePageData = <
  T extends {request?: unknown; breadcrumbs?: unknown},
>(
  event: T
): T => {
  delete event.request;
  delete event.breadcrumbs;
  return event;
};

/**
 * Options both `Sentry.init` calls (Background, ContentScript) pass, beside
 * their own `integrations`, which go through `sentryIntegrations`.
 *
 * `beforeSendTransaction` is left out on purpose: Sentry 11 sends spans as a
 * stream by default and ignores it. Tracing runs in the background only, whose
 * spans name the background script and the requests it makes (the dashboard's
 * token endpoint), never a page. In the content script, tracing named its
 * page-load and navigation spans, and the transaction of every error event,
 * after the page's path, so it has none.
 */
export const SENTRY_PRIVACY_OPTIONS = {
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeSend: removePageData,
  beforeBreadcrumb: (): null => null,
} satisfies Partial<InitOptions>;
