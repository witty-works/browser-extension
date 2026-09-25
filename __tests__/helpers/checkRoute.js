const { ALERTS, buildCheckResult, checkResponse } = require('./mockApi');

const [GUYS] = ALERTS;

/**
 * Answer `/v2.4/check` like an NLP API that flags every "guys", for tests of
 * how the extension sends a text and uses the answers.
 *
 * - `limit`: the API checks only this many characters of a request, flags it
 *   `limit_reached`, and finds nothing past it.
 * - `answer(text, index)`: called per request before answering; may return
 *   `{status}` to fail it, `{fields}` to add response fields, or a promise
 *   to hold it.
 *
 * Returns the texts of the requests, in order.
 */
const routeCheck = async (context, { limit = Infinity, answer } = {}) => {
  const requests = [];
  await context.route(
    (url) => url.pathname.endsWith('/v2.4/check'),
    async (route) => {
      const text = JSON.parse(route.request().postData() || '{}').text || '';
      const index = requests.push(text) - 1;
      const override = answer ? await answer(text, index) : undefined;
      if (override?.status) {
        return route
          .fulfill({ status: override.status, body: '{"detail":"failed"}' })
          .catch(() => undefined);
      }
      const results = [...text.slice(0, limit).matchAll(/\bguys\b/g)].map(
        (match, n) =>
          buildCheckResult(
            { ...GUYS, start: match.index, end: match.index + 4 },
            n
          )
      );
      // An aborted request can no longer be answered; that is expected.
      return route
        .fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...checkResponse(''),
            results,
            limit_reached: text.length > limit,
            ...override?.fields,
          }),
        })
        .catch(() => undefined);
    }
  );
  return requests;
};

/** `count` distinct filler sentences without anything to flag. */
const filler = (count, from = 0) =>
  Array.from(
    { length: count },
    (_, index) => `Sentence number ${from + index} is filler without any issue.`
  ).join(' ');

/**
 * Replace the field's text as a user editing it would be noticed: the content
 * script checks on `keyup` (and `paste`), not on `input`, so a programmatic
 * fill after the first one (which focusing checks) needs the key event too.
 */
const editText = async (page, text) => {
  const editor = page.locator('#editor');
  await editor.fill(text);
  await editor.dispatchEvent('keyup');
};

module.exports = { routeCheck, filler, editText };
