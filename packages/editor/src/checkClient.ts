// Type-only: erased at build time, so nothing from the extension is bundled.
// Moves to packages/core with the Phase 2 extraction.
import type {ICheckResponse} from '../../../source/shared/types';

export type {
  ICheckResponse,
  ICheckResponseResult,
} from '../../../source/shared/types';

/** Checks `text`; must reject (or resolve, ignored) once `signal` aborts. */
export type Checker = (
  text: string,
  signal: AbortSignal
) => Promise<ICheckResponse>;

export interface HttpCheckerOptions {
  /** API base URL with trailing slash, e.g. `https://default.api.witty.works/`. */
  endpoint: string;
  /** Extra headers, e.g. an Authorization header from a credential provider. */
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
  lang?: string;
  client?: string;
}

/** A `Checker` that POSTs to the NLP API's `/v2.4/check`. */
export const createHttpChecker =
  ({
    endpoint,
    headers,
    lang = 'auto',
    client = 'witty-editor-poc',
  }: HttpCheckerOptions): Checker =>
  async (text, signal) => {
    const response = await fetch(`${endpoint}v2.4/check`, {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(headers ? await headers() : {}),
      },
      body: JSON.stringify({text, lang, id: client, client}),
    });

    if (!response.ok) {
      throw new Error(`check failed: HTTP ${response.status}`);
    }

    return (await response.json()) as ICheckResponse;
  };
