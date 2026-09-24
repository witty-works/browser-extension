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
      const {detail, types} = await errorDetail(response);
      throw new CheckHttpError(response.status, detail, types);
    }

    return (await response.json()) as ICheckResponse;
  };
