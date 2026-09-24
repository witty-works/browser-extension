import type {Editor} from '@tiptap/core';

/**
 * The editor's public API types: what `dist/witty-editor.d.ts` declares for
 * the package (`npm run build:types`). The only source of these types; the
 * modules that use them import them from here. Keep this module free of
 * imports other than types from @tiptap/core, so the declarations stand on
 * their own.
 */

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
 * What the user can change in the editor's settings panel, and what the host
 * can set through the handle. One store, so the panel, `setConfig` and the
 * checker never disagree.
 */
export interface EditorSettings {
  /** Sent with every check; only fields that were set. */
  config: CheckConfig;
  /** Offer the LLM's sentence rewrites in the popover. */
  llmAlternatives: boolean;
  /**
   * Witty checks spelling, so the browser's own spellcheck is off. Off here,
   * the browser underlines misspellings as well.
   */
  orthography: boolean;
}

export type SwitchOutcome =
  /** Forms were rewritten. */
  | 'switched'
  /** Nothing in the text needed rewriting. */
  | 'nothing'
  /** The account's configuration keeps these alerts off (a stored force). */
  | 'disabled'
  /** The API predates bulk alerts. */
  | 'unsupported'
  /** The account forces another format; nothing was changed. */
  | 'forced'
  /**
   * Nothing to switch, and the text was in the Inklusivum: the API does not
   * convert out of it yet, so nothing may well have been possible.
   */
  | 'fromInklusivum'
  /** Not a gender format of German or French. */
  | 'unavailable';

export interface GenderFormatSwitchResult {
  outcome: SwitchOutcome;
  target: string;
  /** Forms rewritten. */
  count: number;
  /** Part of the text was not checked, so it may hold unswitched forms. */
  limitReached: boolean;
  /** With `forced`: the format the account enforces. */
  applied?: string;
}

export type EditorStatus =
  /**
   * `limitReached`: part of the text was not checked, because it is longer
   * than `maxTextLength` or a sentence exceeds what the API checks at once.
   */
  | {
      state: 'idle';
      alerts: number;
      limitReached: boolean;
      /** Set once, on the status right after a gender format switch. */
      genderFormatSwitch?: GenderFormatSwitchResult;
    }
  /** The API refused the key (401), or the token behind it (403). */
  | {state: 'unauthorized'}
  /**
   * The API no longer supports this version of the editor (400): the host
   * page needs to load a newer one. `message` is the API's explanation.
   */
  | {state: 'outdated'; message: string}
  /** The API could not tell the text's language (422). */
  | {state: 'unsupportedLanguage'}
  /** Anything else, e.g. the API is unreachable; the last alerts stay. */
  | {state: 'error'; message: string};

export interface MountOptions {
  /** NLP API base URL with trailing slash; defaults to the page's origin. */
  endpoint?: string;
  /** Sent as `x-key`. Set later with `setApiKey`; never read from the DOM. */
  apiKey?: string;
  /** Language of the text, or `auto` (the default) to let the API detect it. */
  lang?: CheckLang;
  /**
   * Per-request check config. Only the fields set here are sent, so the user's
   * stored settings keep deciding the rest. Replace it later with `setConfig`.
   */
  config?: CheckConfig;
  /** Initial content (HTML). */
  content?: string;
  /**
   * The formatting bar with the Witty settings button (categories, gender
   * formats, spelling, AI suggestions). On by default.
   */
  toolbar?: boolean;
  /** Called when the user changes a setting in the settings panel. */
  onSettingsChange?: (settings: EditorSettings) => void;
  /** Accessible name of the editable area. */
  label?: string;
  /**
   * Ids of elements that further describe the editable area, separated by
   * spaces; added to its `aria-describedby` after the component's own hint.
   */
  describedBy?: string;
  /**
   * Characters per check request; longer texts are checked sentence by
   * sentence over several requests. Match the API's TEXT_MAX_LENGTH (1000 by
   * default); a lower limit is detected and batches shrink.
   */
  maxRequestLength?: number;
  /** Characters of the text checked at all (default 20000). */
  maxTextLength?: number;
  /** Debounce after the last edit, in ms. */
  delay?: number;
  /**
   * Opaque id sent with each check (`id`), as the extension sends its
   * installation id; it only ends up in the API's request logs. Defaults to
   * a random id per editor, kept in memory. Pass a stable one, never personal
   * data, to tell installations apart across page loads.
   */
  installationId?: string;
  /**
   * Offer the LLM's sentence rewrites in the popover (`/v1.0/rephrase`). The
   * extension takes this from the organisation config.
   */
  llmAlternatives?: boolean;
  /**
   * How long to wait for the rewrites, in ms. The extension's 3s suits a
   * hosted model; a local one (Ollama) needs longer.
   */
  llmTimeoutMs?: number;
  onStatus?: (status: EditorStatus) => void;
}

export interface WittyEditorHandle {
  editor: Editor;
  /** Replace the API key (empty string clears it) and check again. */
  setApiKey(key: string): void;
  /**
   * Replace the whole check config — this does not merge — and check again.
   * `{}` goes back to sending no `config`, i.e. the account's own settings.
   */
  setConfig(config: CheckConfig): void;
  /**
   * Change settings as the settings panel does, e.g. from the host's own form
   * (the panel follows): the fields given replace the current ones, the rest
   * stay. `config`, when given, is replaced whole, as with `setConfig`; start
   * from a copy of `getSettings().config` to change one field of it. Calls
   * `onSettingsChange` once if anything changed. A changed `config` checks
   * again; popovers opened afterwards follow `llmAlternatives`, an open one
   * keeps what it shows.
   */
  updateSettings(settings: Partial<EditorSettings>): void;
  /** Plain text of the document. */
  getText(): string;
  /**
   * The current settings: what `onSettingsChange` receives, as a copy. For a
   * host that sends the same `config` with its own API calls.
   */
  getSettings(): EditorSettings;
  /**
   * Rewrite every gendered form in the text into `target` (a German gender
   * ending such as ':in'), in one undoable step, and make it the configured
   * format. Resolves once the text has been checked and switched. Needs an NLP
   * API with bulk alerts; see the README.
   */
  switchGenderFormat(target: string): Promise<GenderFormatSwitchResult>;
  destroy(): void;
}

/** `WittyEditor.mount` / the module's `mount`. */
export type Mount = (
  element: HTMLElement,
  options?: MountOptions
) => WittyEditorHandle;
