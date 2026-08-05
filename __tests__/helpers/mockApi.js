/**
 * Canned NLP API responses.
 *
 * The suite used to point at a deployed dashboard and a live NLP API, which
 * made it non-runnable offline, dependent on shared test-account state, and
 * unable to produce stable highlight snapshots (the API's rules change, so the
 * same text yields different alerts over time). Everything the extension needs
 * from the network is served from here instead.
 *
 * The offsets below are hand-computed against SAMPLE_TEXT. If you change that
 * string, recompute them — `start`/`end` are absolute character offsets and the
 * extension positions highlights from them, so a wrong offset shows up as a
 * silently misplaced highlight rather than an error.
 */

const SAMPLE_TEXT =
  'Hey guys, the chairman will assume the leadership role. This is a spelling mistacke.';

//                       1         2         3         4         5         6         7         8
//             0123456789012345678901234567890123456789012345678901234567890123456789012345678901234
// SAMPLE_TEXT: Hey guys, the chairman will assume the leadership role. This is a spelling mistacke.
const ALERTS = [
  {
    text: 'guys',
    start: 4,
    end: 8,
    category: 'gendered',
    subcategory: 'gendered_nouns',
    gravity: 2,
    label: 'Gendered language',
    alternatives: [
      {
        text: 'everyone',
        remove: false,
        inspiration: false,
        context: '',
        url: '',
      },
      {
        text: 'folks',
        remove: false,
        inspiration: false,
        context: '',
        url: '',
      },
    ],
  },
  {
    text: 'chairman',
    start: 14,
    end: 22,
    category: 'gendered',
    subcategory: 'gendered_nouns',
    gravity: 2,
    label: 'Gendered language',
    alternatives: [
      {
        text: 'chairperson',
        remove: false,
        inspiration: false,
        context: '',
        url: '',
      },
      {
        text: 'chair',
        remove: false,
        inspiration: false,
        context: '',
        url: '',
      },
      // Deliberately past both truncation thresholds (25 chars with a context,
      // 35 without) so the hover-stability test exercises the path that used to
      // expand the button on hover and move it out from under the pointer.
      {
        text: 'the person presiding over the meeting',
        remove: false,
        inspiration: false,
        context: 'formal',
        url: '',
      },
    ],
  },
  {
    text: 'mistacke',
    start: 75,
    end: 83,
    category: 'orthography',
    subcategory: 'spelling',
    gravity: 1,
    label: 'Spelling',
    alternatives: [
      {
        text: 'mistake',
        remove: false,
        inspiration: false,
        context: '',
        url: '',
      },
    ],
  },
];

const buildCheckResult = (alert, index) => ({
  text: alert.text,
  text_id: `fixture-${index}`,
  context: SAMPLE_TEXT,
  category: alert.category,
  subcategory: alert.subcategory,
  start: alert.start,
  end: alert.end,
  alternatives: alert.alternatives,
  explanation: {
    text: `${alert.label} — fixture explanation`,
    long_text: `${alert.label} — fixture explanation (long)`,
    icon: '',
    icon_image: '',
    url: '',
    context: '',
    content: '',
  },
  label: alert.label,
  gravity: alert.gravity,
  language: 'en',
  limit_reached: false,
  source: { text: '', url: '' },
});

const authResponse = () => ({
  config: { orthography: { value: true, status: 'suggestion' } },
  organization_config: {
    orthography: { value: true, status: 'suggestion' },
    categories: { orthography: true },
    llm_alternatives: { value: false, status: 'suggestion' },
  },
  min_version: '0.0.0',
  id: 'fixture-user',
  name: 'Fixture User',
  domains: { list: [], type: 'deny' },
  config_hash: 'fixture-config-hash',
  organization_id: 'fixture-org',
  organization_name: 'Fixture Org',
  organization_domains: { list: [], type: 'deny' },
  organization_config_hash: 'fixture-org-config-hash',
});

/**
 * Only return alerts whose span actually falls inside the submitted text. The
 * extension sends whatever is in the field, including the empty string on
 * initialisation, and returning out-of-range offsets for text that is not there
 * yet would place highlights at nonsense coordinates.
 */
const checkResponse = (text) => ({
  results: ALERTS.filter(
    (alert) =>
      alert.end <= text.length &&
      text.slice(alert.start, alert.end) === alert.text
  ).map(buildCheckResult),
  language: 'en',
  limit_reached: false,
  config_changed: false,
  notifications: 0,
  gender_separator: '*',
});

/**
 * `GET /v2.0/categories` — the list the options page renders toggles from.
 *
 * `slurs` is `openly_discriminating`, which the UI must lock on; `plain_language`
 * has no advanced variant, so its toggle only cycles off ↔ basic.
 */
const CATEGORIES = {
  groups: [
    { key: 'gender', label: 'Gender' },
    { key: 'clarity', label: 'Clarity' },
  ],
  categories: [
    {
      key: 'gendered_nouns',
      label: 'Gendered nouns',
      parent: 'gender',
      advanced_key: 'gendered_nouns_advanced',
      proficiency_level: 'unconscious_bias',
    },
    {
      key: 'slurs',
      label: 'Slurs',
      parent: 'gender',
      advanced_key: null,
      proficiency_level: 'openly_discriminating',
    },
    // Mirrors the real response, where 12 of 68 categories come back unlabelled.
    {
      key: 'plain_language',
      label: '',
      parent: 'clarity',
      advanced_key: null,
      proficiency_level: 'orthography',
    },
  ],
};

/**
 * `GET /v2.0/config-options` — the values the gender fields accept.
 *
 * `inclusive_gender` is the Inklusivum; the options page has to offer it by
 * name rather than as a raw enum value.
 */
const CONFIG_OPTIONS = {
  options: {
    gendered_roles_format: {
      values: ['none', 'both', 'inclusive_gender', 'binary_gender'],
      default: 'inclusive_gender',
      labels: {
        none: 'Suggest only gender-neutral alternatives',
        both: 'Suggest both the chosen gender separator and the female and male form',
        inclusive_gender: 'Suggest the chosen gender separator',
        binary_gender: 'Suggest the female and male form',
      },
    },
    german_gender_ending: {
      values: ['/in', '/-in', '_in', '*in', ':in', '(-)', '()', 'In'],
      default: '*in',
      // `(-)` and `()` are deliberately unlabelled: the dashboard has no wording
      // for them, so the options page must fall back to the raw value.
      labels: {
        '*in': 'Genderstar, f.e Expert*in',
        ':in': 'Colon, f.e Expert:in',
        _in: 'Gendergap, f.e Expert_in',
        '/in': 'Slash, f.e Expert/in',
        '/-in': 'Slash dash, f.e Expert/-in',
        In: 'Binnen-I, f.e ExpertIn',
      },
    },
    french_gender_separator: {
      values: ['·', '·s', '.', '.s', '/', '/s'],
      default: '·',
      labels: { '·': 'Point médian, f.e. expert·es' },
    },
  },
};

/**
 * Intercept every NLP API call the extension makes, regardless of which
 * BASE_URLS entry the build points at — matching on pathname rather than host
 * keeps the mock working when the configured endpoint changes.
 */
const mockNlpApi = async (context) => {
  await context.route(
    (url) => url.pathname.endsWith('/v2.0/auth'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authResponse()),
      })
  );

  await context.route(
    (url) => url.pathname.endsWith('/v2.4/check'),
    (route) => {
      let text = '';
      try {
        text = JSON.parse(route.request().postData() || '{}').text || '';
      } catch (error) {
        text = '';
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(checkResponse(text)),
      });
    }
  );

  await context.route(
    (url) => url.pathname.endsWith('/v2.0/categories'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CATEGORIES),
      })
  );

  await context.route(
    (url) => url.pathname.endsWith('/v2.0/config-options'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CONFIG_OPTIONS),
      })
  );

  // The rephrase endpoint is behind a feature flag and unused by these tests,
  // but leaving it unrouted would let a request escape to a real host.
  await context.route(
    (url) => url.pathname.endsWith('/v1.0/rephrase'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sentence: '', results: {} }),
      })
  );
};

/**
 * Fail the test rather than silently reaching the internet. Any request that
 * escapes the mocks above is a bug in the harness — the whole point is that the
 * suite runs with no deployed dashboard and no NLP API.
 */
const blockExternalRequests = async (
  context,
  allowedHosts = ['localhost', '127.0.0.1']
) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());

    if (
      url.protocol === 'chrome-extension:' ||
      allowedHosts.includes(url.hostname)
    ) {
      return route.continue();
    }

    console.warn(`[test] blocked external request: ${url.href}`);
    return route.abort();
  });
};

module.exports = {
  CATEGORIES,
  CONFIG_OPTIONS,
  SAMPLE_TEXT,
  ALERTS,
  authResponse,
  checkResponse,
  mockNlpApi,
  blockExternalRequests,
};
