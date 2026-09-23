/**
 * Write source/witty.config.json for a tag build, from the committed example.
 *
 * witty.config.json is not in git (it holds developer settings), so the tag
 * workflows start from witty.config.json.example and set the release values
 * here. This replaces sed edits that silently stopped matching once the
 * config moved out of constants.ts.
 *
 *   SENTRY_DSN, SENTRY_SAMPLE_RATE, SENTRY_TRACE_RATE   taken from the env when set
 *   --prod                                             keep only the Prod endpoint
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'source');
const EXAMPLE = path.join(SOURCE, 'witty.config.json.example');
const CONFIG = path.join(SOURCE, 'witty.config.json');

const { assertNoBakedInCredentials } = require('./credentialGuard');

const main = (args) => {
  const config = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));

  const { SENTRY_DSN, SENTRY_SAMPLE_RATE, SENTRY_TRACE_RATE } = process.env;
  if (SENTRY_DSN) config.SENTRY_DSN = SENTRY_DSN;
  if (SENTRY_SAMPLE_RATE)
    config.SENTRY_SAMPLE_RATE = Number(SENTRY_SAMPLE_RATE);
  if (SENTRY_TRACE_RATE) config.SENTRY_TRACE_RATE = Number(SENTRY_TRACE_RATE);

  // Store builds carry no development or local endpoints. A key a user still
  // has stored (e.g. 'Dev') falls back to the build default.
  if (args.includes('--prod')) {
    config.BASE_URLS = { Prod: config.BASE_URLS.Prod };
  }

  fs.writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`);

  // The same guard the webpack build runs, here so a problem is reported
  // before anything is built.
  assertNoBakedInCredentials({
    nodeEnv: 'production',
    testing: false,
    configPath: CONFIG,
  });

  console.log(
    `wrote ${path.relative(process.cwd(), CONFIG)}: endpoints ${Object.keys(
      config.BASE_URLS
    ).join(', ')}, Sentry sample rate ${config.SENTRY_SAMPLE_RATE}`
  );
};

main(process.argv.slice(2));
