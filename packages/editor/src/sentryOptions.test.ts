// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as Sentry from '@sentry/react';

import {
  SENTRY_DATA_COLLECTION,
  SENTRY_PRIVACY_OPTIONS,
  sentryIntegrations,
} from '@witty/core/sentryOptions';

// The options the extension passes to Sentry.init (Background, ContentScript),
// run through a real client whose transport keeps the envelopes it would send.
// The content script runs on every page the user visits, so nothing about the
// page may leave in an error report.

const PAGE_URL = 'https://intranet.example/salary-review/report?draft=1';

let sent: string[] = [];

const captureTransport = (): ReturnType<
  NonNullable<Parameters<typeof Sentry.init>[0]>['transport'] & {}
> => {
  return {
    send: async (envelope) => {
      sent.push(JSON.stringify(envelope));
      return {statusCode: 200};
    },
    flush: async () => true,
  };
};

/** Do what a page and our code do around an error, then report one. */
const reportAnError = async (): Promise<void> => {
  history.pushState({}, '', '/salary-review/next-page');
  console.log(`visiting ${PAGE_URL}`);
  document.body.innerHTML = '<button id="send-salary">Send</button>';
  document.getElementById('send-salary')?.click();
  Sentry.addBreadcrumb({category: 'manual', data: {url: PAGE_URL}});
  Sentry.captureException(new Error('boom'));
  await Sentry.flush(2000);
};

interface SentEvent {
  request?: {url?: string};
  breadcrumbs?: unknown[];
}

type EnvelopeItem = [{type: string}, SentEvent];

const errorEvents = (): SentEvent[] =>
  sent
    .flatMap((envelope) => JSON.parse(envelope)[1] as EnvelopeItem[])
    .filter(([header]) => header.type === 'event')
    .map(([, event]) => event);

beforeEach(() => {
  sent = [];
  // happy-dom's own setter; assigning location.href would try to navigate.
  (
    window as unknown as {happyDOM: {setURL: (url: string) => void}}
  ).happyDOM.setURL(PAGE_URL);
});

afterEach(async () => {
  await Sentry.getClient()?.close();
});

const baseOptions = {
  dsn: 'https://public@o0.ingest.sentry.io/0',
  transport: captureTransport,
  sampleRate: 1,
};

describe('Sentry options', () => {
  it('without them, a report carries the page address and breadcrumbs', async () => {
    // Shows that this test would notice the data it checks for below.
    Sentry.init({...baseOptions, dataCollection: SENTRY_DATA_COLLECTION});
    await reportAnError();

    const [event] = errorEvents();
    expect(event.request?.url).toContain('intranet.example');
    expect(event.breadcrumbs?.length).toBeGreaterThan(0);
  });

  it('with them, a report carries no page address and no breadcrumbs', async () => {
    Sentry.init({
      ...baseOptions,
      integrations: sentryIntegrations(),
      ...SENTRY_PRIVACY_OPTIONS,
    });
    await reportAnError();

    const events = errorEvents();
    expect(events).toHaveLength(1);
    expect(events[0].request).toBeUndefined();
    expect(events[0].breadcrumbs).toBeUndefined();
    // Nowhere in anything sent, session updates included.
    for (const envelope of sent) {
      expect(envelope).not.toContain('intranet.example');
      expect(envelope).not.toContain('salary-review');
      expect(envelope).not.toContain('send-salary');
    }
  });

  it('leaves out the integrations that record the page', () => {
    const names = sentryIntegrations()(Sentry.getDefaultIntegrations({})).map(
      (integration) => integration.name
    );

    expect(names).not.toContain('HttpContext');
    expect(names).not.toContain('Breadcrumbs');
    expect(names).not.toContain('Console');
    expect(names).toContain('GlobalHandlers');
  });
});
