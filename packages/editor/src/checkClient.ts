// The request shape is shared with the extension, so both send the same body
// and credential headers.
import {
  buildCheckBody,
  CHECK_PATH,
  JSON_HEADERS,
} from '@witty/core/ApiServices/requests';
import {wittyVersion} from '@witty/core/constants';
import type {ICheckResponse} from '@witty/core/types';
import type {CheckConfig, CheckLang} from './api';

export type {CheckConfig, CheckLang, CheckVariant} from './api';

export type {ICheckResponse, ICheckResponseResult} from '@witty/core/types';

/** Checks `text`; must reject (or resolve, ignored) once `signal` aborts. */
export type Checker = (
  text: string,
  signal: AbortSignal
) => Promise<ICheckResponse>;

/**
 * Drops `undefined` fields, and the whole object once nothing is left: an
 * empty `config` would read as "no preference" rather than "unset", so the
 * body omits the key entirely instead.
 */
export const cleanConfig = (config?: CheckConfig): CheckConfig | undefined => {
  if (!config) return undefined;
  const entries = Object.entries(config).filter(
    ([, value]) => value !== undefined
  );
  return entries.length
    ? (Object.fromEntries(entries) as CheckConfig)
    : undefined;
};

/**
 * How long a check request may take before it fails, in ms. A long batch
 * takes the API a few seconds; without a limit, a request that never returns
 * would leave the check, and a gender format switch waiting for it, pending
 * for good.
 */
export const CHECK_TIMEOUT_MS = 30_000;

/** A check request that took longer than its timeout. */
export class CheckTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`check failed: no answer within ${timeoutMs / 1000}s`);
    this.name = 'CheckTimeoutError';
  }
}

export interface HttpCheckerOptions {
  /** API base URL with trailing slash, e.g. `https://default.api.witty.works/`. */
  endpoint: string;
  /** See CHECK_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Extra headers, e.g. an Authorization header from a credential provider. */
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
  lang?: CheckLang;
  /**
   * `name:version`, as the API parses it: without a name it assumes the
   * browser extension ("web-ext") and applies that client's minimum version.
   */
  client?: string;
  /** Anonymous installation id, as the extension sends one. */
  id?: string;
  /**
   * Read per request, like `headers`, so `setConfig` reaches the next check
   * without re-creating the editor.
   */
  config?: () => CheckConfig | undefined;
}

/**
 * Gender format for a `/v1.0/rephrase` request about text in `language`: the
 * config field that governs that language, if the caller set it. Otherwise
 * `undefined`, so the rewrite follows the account's setting like the check.
 */
export const genderSeparatorFor = (
  language: string | undefined,
  config?: CheckConfig
): string | undefined => {
  if (language?.startsWith('de')) return config?.german_gender_ending;
  if (language?.startsWith('fr')) return config?.french_gender_separator;
  return undefined;
};

/**
 * The NLP API base URL the editor sends requests to, from the `endpoint`
 * option: resolved against the page (so `/nlp/` works, and no option means
 * the page's own origin), `http:` or `https:` only, without query or
 * fragment, and ending in a slash so paths can be appended. Anything else
 * throws a `TypeError` when the editor is mounted rather than failing later
 * on the first request.
 */
export const apiEndpoint = (
  value: string | undefined,
  page: string
): string => {
  let url: URL;
  try {
    url = new URL(value ?? '/', page);
  } catch (error) {
    throw new TypeError(`endpoint is not a URL: ${String(value)}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError(`endpoint must be an http(s) URL: ${String(value)}`);
  }
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  return url.href;
};

/**
 * `client` on every request the editor makes, as the API parses it
 * (`name:version`): it checks the editor against its own minimum version
 * (MINIMUM_VERSION_WITTY_EDITOR), separately from the extension.
 */
export const EDITOR_CLIENT = `witty-editor:${wittyVersion}`;

/** The error type of a 422 the API sends for text in a language it can't tell. */
export const LANGUAGE_NOT_SUPPORTED = 'value_error.not_supported';

/**
 * A non-2xx answer from the API. `status` lets callers tell 401/403 apart;
 * `types` are the `type`s of the API's validation errors, e.g. a 422 for an
 * undetermined language (`LANGUAGE_NOT_SUPPORTED`) from one for a bad request.
 */
export class CheckHttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail?: string,
    readonly types: string[] = []
  ) {
    super(`check failed: HTTP ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'CheckHttpError';
  }
}

/**
 * The API's own explanation of a refused request, e.g. which config value a
 * 422 rejected. FastAPI sends `detail` as a string or as a list of
 * `{loc, msg, type}` validation errors.
 */
const errorDetail = async (
  response: Response
): Promise<{detail?: string; types: string[]}> => {
  try {
    const {detail} = (await response.json()) as {
      detail?: string | {loc?: unknown[]; msg?: string; type?: string}[];
    };
    if (typeof detail === 'string') return {detail, types: []};
    if (Array.isArray(detail)) {
      return {
        detail: detail
          .map(({loc, msg}) =>
            [loc?.slice(1).join('.'), msg].filter(Boolean).join(': ')
          )
          .join('; '),
        types: detail.flatMap(({type}) => (type ? [type] : [])),
      };
    }
  } catch (error) {
    // Not JSON; the status alone has to do.
  }
  return {types: []};
};

/** A `Checker` that POSTs to the NLP API's `/v2.4/check`. */
export const createHttpChecker =
  ({
    endpoint,
    headers,
    lang = 'auto',
    client = EDITOR_CLIENT,
    // `mount` passes a random one per editor.
    id = 'witty-editor',
    config,
    timeoutMs = CHECK_TIMEOUT_MS,
  }: HttpCheckerOptions): Checker =>
  async (text, signal) => {
    const cleaned = cleanConfig(config?.());
    // Aborted by the caller (a newer check) or by the timeout, whichever
    // comes first; only the timeout is an error.
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    if (signal.aborted) abort();
    signal.addEventListener('abort', abort);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${endpoint}${CHECK_PATH}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {...JSON_HEADERS, ...(headers ? await headers() : {})},
        body: JSON.stringify(
          buildCheckBody({text, lang, id, client, config: cleaned})
        ),
      });

      if (!response.ok) {
        const {detail, types} = await errorDetail(response);
        throw new CheckHttpError(response.status, detail, types);
      }

      return (await response.json()) as ICheckResponse;
    } catch (error) {
      if (timedOut) throw new CheckTimeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  };
