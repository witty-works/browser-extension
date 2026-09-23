// The request shape is shared with the extension, so both send the same body
// and credential headers.
import {
  buildCheckBody,
  CHECK_PATH,
  JSON_HEADERS,
} from '@witty/core/ApiServices/requests';
import {wittyVersion} from '@witty/core/constants';
import type {ICheckResponse} from '@witty/core/types';

export type {ICheckResponse, ICheckResponseResult} from '@witty/core/types';

/** Checks `text`; must reject (or resolve, ignored) once `signal` aborts. */
export type Checker = (
  text: string,
  signal: AbortSignal
) => Promise<ICheckResponse>;

/** Languages `POST /v2.4/check` accepts; `auto` detects. */
export type CheckLang =
  | 'auto'
  | 'en'
  | 'de'
  | 'fr'
  | 'de-DE'
  | 'de-CH'
  | 'de-AT'
  | 'en-US'
  | 'en-GB'
  | 'fr-FR';

/** Regional variants, for `primary_language` and `preferred_variants`. */
export type CheckVariant =
  'de-DE' | 'de-CH' | 'de-AT' | 'en-US' | 'en-GB' | 'fr-FR';

/**
 * Per-request `config` for `POST /v2.4/check`.
 *
 * Every field is optional, and only the ones a caller actually set are sent:
 * a field in the request overrides the user's stored config where that config
 * marks it `suggestion`, an omitted field keeps the stored value or the server
 * default, and a stored `force` wins either way. Filling in defaults here would
 * silently override the account's own settings.
 *
 * `alternatives_max_count` is deliberately absent — the server overwrites it.
 */
export interface CheckConfig {
  /** Gender ending, as offered by `GET /v2.0/config-options`. `de-e` is Inklusivum. */
  german_gender_ending?:
    '/in' | '/-in' | '_in' | '*in' | ':in' | '(-)' | '()' | 'In' | 'de-e';
  french_gender_separator?: '·' | '·s' | '.' | '.s' | '/' | '/s';
  gendered_roles_format?:
    'none' | 'both' | 'inclusive_gender' | 'binary_gender';
  /**
   * Category keys from `GET /v2.0/categories`. A category and its
   * `advanced_key` have to be disabled together.
   */
  disabled_categories?: string[];
  show_inspiration_alternatives?: boolean;
  primary_language?: CheckVariant;
  preferred_languages?: ('en' | 'de' | 'fr')[];
  preferred_variants?: CheckVariant[];
  addons?: string[];
  /** Ignored unless the deployment sets `CLIENT_CONFIG_ENABLED`. */
  store_context?: boolean;
  /** Same, and the operator's `LLM_ACCESS` policy can still turn it off. */
  llm_alternatives?: boolean;
}

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

export interface HttpCheckerOptions {
  /** API base URL with trailing slash, e.g. `https://default.api.witty.works/`. */
  endpoint: string;
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

/** A non-2xx answer from the API; `status` lets callers tell 401/403 apart. */
export class CheckHttpError extends Error {
  constructor(
    readonly status: number,
    detail?: string
  ) {
    super(`check failed: HTTP ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'CheckHttpError';
  }
}

/**
 * The API's own explanation of a refused request, e.g. which config value a
 * 422 rejected. FastAPI sends `detail` as a string or as a list of
 * `{loc, msg}` validation errors.
 */
const errorDetail = async (response: Response): Promise<string | undefined> => {
  try {
    const {detail} = (await response.json()) as {
      detail?: string | {loc?: unknown[]; msg?: string}[];
    };
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map(({loc, msg}) =>
          [loc?.slice(1).join('.'), msg].filter(Boolean).join(': ')
        )
        .join('; ');
    }
  } catch (error) {
    // Not JSON; the status alone has to do.
  }
  return undefined;
};

/** A `Checker` that POSTs to the NLP API's `/v2.4/check`. */
export const createHttpChecker =
  ({
    endpoint,
    headers,
    lang = 'auto',
    client = `witty-editor:${wittyVersion}`,
    id = 'witty-editor',
    config,
  }: HttpCheckerOptions): Checker =>
  async (text, signal) => {
    const cleaned = cleanConfig(config?.());
    const response = await fetch(`${endpoint}${CHECK_PATH}`, {
      method: 'POST',
      signal,
      headers: {...JSON_HEADERS, ...(headers ? await headers() : {})},
      body: JSON.stringify(
        buildCheckBody({text, lang, id, client, config: cleaned})
      ),
    });

    if (!response.ok) {
      throw new CheckHttpError(response.status, await errorDetail(response));
    }

    return (await response.json()) as ICheckResponse;
  };
