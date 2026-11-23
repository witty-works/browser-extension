import type * as Sentry from '@sentry/react';

type DataCollection = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>['dataCollection']
>;

/**
 * What Sentry may collect beyond the error itself: nothing about the user or
 * the pages and requests around it.
 *
 * Sentry 11 replaced `sendDefaultPii` (off by default) with `dataCollection`,
 * whose defaults collect everything: the user's IP address, cookies, request
 * and response headers (ours carry the API key and the access token) and
 * bodies (a check request carries the text being checked), and URL query
 * parameters (the content script runs on every page the user visits). Left
 * unset, an error report from 2.7.0 on would have sent all of that. Set both
 * where Sentry is initialised (Background, ContentScript).
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
