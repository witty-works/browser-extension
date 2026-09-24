import type {EditorState, Transaction} from '@tiptap/pm/state';

import type {CheckConfig} from './checkClient';
import type {Alert} from './checkPlugin';
import type {SwitchOutcome} from './api';

export type {GenderFormatSwitchResult, SwitchOutcome} from './api';

/**
 * Switching a text's gender format in one step, driven by the API's bulk
 * alerts (EDITOR: "Switch gender format…" in the W menu). German texts switch
 * between the separator formats and into the Inklusivum; French texts between
 * the French separator formats.
 *
 * With the target set in the language's config field (`german_gender_ending`
 * or `french_gender_separator`), the NLP API marks with `bulk: "gender_format"`
 * every gendered form written in another format, every role in the generic
 * masculine, and the pair formulas and doublets it recognises. Each names the
 * alternative to apply in `bulk_alternative` (a separator mismatch has exactly
 * one; older API versions leave the index out for those). The alerts never
 * overlap, and accepting all of them, in any order, is the switch. Only `bulk`
 * decides what is applied; older API versions have the same subcategory but
 * convert incompletely (articles and determiners were skipped). Whether the
 * API can switch to a target at all comes from `bulk_actions`.
 */

export const GENDER_FORMAT_BULK = 'gender_format';

type GenderEnding = NonNullable<CheckConfig['german_gender_ending']>;
type FrenchSeparator = NonNullable<CheckConfig['french_gender_separator']>;

/** The languages whose gender format can be switched. */
export type SwitchLanguage = 'de' | 'fr';

/** The Inklusivum: the API switches into it, not yet out of it. */
export const INKLUSIVUM: GenderEnding = 'de-e';

/** The formats the API converts to, per language, in its own order. */
export const SWITCHABLE_FORMATS: {
  de: GenderEnding[];
  fr: FrenchSeparator[];
} = {
  de: ['/in', '/-in', '_in', '*in', ':in', '(-)', '()', 'In', INKLUSIVUM],
  fr: ['·', '·s', '.', '.s', '/', '/s'],
};

/** The config field holding a language's format. */
export const FORMAT_FIELD = {
  de: 'german_gender_ending',
  fr: 'french_gender_separator',
} as const;

/** The language a target format belongs to; `null` for anything else. */
export const formatLanguage = (target: string): SwitchLanguage | null => {
  if ((SWITCHABLE_FORMATS.de as string[]).includes(target)) return 'de';
  if ((SWITCHABLE_FORMATS.fr as string[]).includes(target)) return 'fr';
  return null;
};

/** Whether an API language (`de`, `de-CH`, `fr`) is the switch's language. */
const inLanguage = (
  language: string | undefined,
  switched: SwitchLanguage
): boolean => language?.slice(0, 2) === switched;

/** The subcategory holding the gender-format alerts. */
const GENDER_ENDING_SUBCATEGORY = 'gendered_denominations_ending_advanced';

/** What one of a switch's check responses said about its batch. */
export interface SwitchResponse {
  /** The language the API detected for the batch. */
  language?: string;
  /** The format the API applied in that language (`gender_separator`). */
  separator?: string;
  /** `bulk_actions`; `undefined` where the API sent none. */
  bulkActions?: string[];
}

/** What a switch's check responses said about the request. */
export interface SwitchCheckInfo {
  responses: SwitchResponse[];
}

/**
 * The config for the switch's check: the target format in its language's
 * field, and the gender-format alerts switched on even where the user turned
 * them off (the same subcategory in German and French). The user's own
 * settings are not changed; `needed` says whether this differed from them.
 */
export const switchRequestConfig = (
  config: CheckConfig,
  target: string,
  language: SwitchLanguage = 'de'
): {config: CheckConfig; needed: boolean} => {
  const disabled = config.disabled_categories ?? [];
  const enabled = disabled.filter(
    (key) =>
      key !== GENDER_ENDING_SUBCATEGORY &&
      key !== GENDER_ENDING_SUBCATEGORY.replace(/_advanced$/, '')
  );
  const needed =
    enabled.length !== disabled.length ||
    config.gendered_roles_format === 'none' ||
    config.gendered_roles_format === 'binary_gender';

  return {
    config: {
      ...config,
      [FORMAT_FIELD[language]]: target,
      ...(config.disabled_categories ? {disabled_categories: enabled} : {}),
      gendered_roles_format: 'inclusive_gender',
    },
    needed,
  };
};

/** One replacement of a bulk action. */
export interface BulkEdit {
  from: number;
  to: number;
  text: string;
}

/**
 * The alternative a bulk action applies: `alternatives[bulk_alternative]`.
 * Without `bulk_alternative` (older API versions), the only alternative, if
 * there is exactly one. `null` for anything else.
 */
const bulkAlternative = ({
  alternatives,
  bulk_alternative: index,
}: Alert['detail']['data']): string | null => {
  let chosen;
  if (index === undefined || index === null) {
    chosen = alternatives?.length === 1 ? alternatives[0] : undefined;
  } else if (Number.isInteger(index)) {
    chosen = alternatives?.[index];
  }
  return typeof chosen?.text === 'string' ? chosen.text : null;
};

/**
 * What a switch applies: the chosen alternative of every alert marked for the
 * bulk action, in the switched language only (a mixed text also has the other
 * language's mismatches). Anything else is left one-by-one.
 */
export const bulkEdits = (
  alerts: Alert[],
  language: SwitchLanguage = 'de',
  group = GENDER_FORMAT_BULK
): BulkEdit[] =>
  alerts.flatMap(({from, to, detail}) => {
    if (detail.data.bulk !== group) return [];
    if (!inLanguage(detail.data.language, language)) return [];
    const text = bulkAlternative(detail.data);
    return text === null ? [] : [{from, to, text}];
  });

/**
 * Make every edit in one transaction, so a single undo reverses it. The API
 * promises bulk alerts never overlap; should two do anyway, the one further
 * back is kept and the other skipped, rather than rewriting text an earlier
 * edit already replaced.
 */
export const applyEdits = (
  state: EditorState,
  edits: BulkEdit[]
): Transaction => {
  const tr = state.tr;
  let applied = Infinity;
  // Back to front, so earlier positions stay valid.
  for (const {from, to, text} of [...edits].sort((a, b) => b.from - a.from)) {
    if (to > applied) continue;
    tr.insertText(text, from, to);
    applied = from;
  }
  return tr;
};

// Noun endings and the format they are written in: Lehrer*innen, Lehrer/-in,
// LehrerInnen, Lehrer(innen), Lehrer(-in). Article pairs are left out, as
// `der/die` is valid in several formats. Used only to choose the message when
// nothing was switched, never to decide what to change.
const NOUN_ENDING =
  /\p{Ll}(?:([*_:]|\/-?)in(?:nen)?|(In)(?:nen)?|\((-?)in(?:nen)?\))(?!\p{L})/gu;

const formOf = (match: RegExpMatchArray): string => {
  const [, separator, capital, parenthesis] = match;
  if (capital) return 'In';
  if (parenthesis !== undefined) return parenthesis ? '(-)' : '()';
  return `${separator}in`;
};

/** Whether the text has noun endings written in a format other than `target`. */
export const hasFormsOutside = (text: string, target: string): boolean =>
  [...text.matchAll(NOUN_ENDING)].some((match) => formOf(match) !== target);

/**
 * Why a switch rewrote nothing, guessed for an API that sends no
 * `bulk_actions`. `alerts` are the switch check's results.
 *
 * - Alerts in the gender-format subcategory without `bulk`: an API version
 *   that predates bulk alerts.
 * - Forms in another format, yet no gender-format alerts although the switch
 *   asked for them: the account's stored config forces them off.
 * - Otherwise the text had nothing to switch.
 */
export const noSwitchReason = (
  text: string,
  target: string,
  alerts: Alert[]
): Extract<SwitchOutcome, 'nothing' | 'disabled' | 'unsupported'> => {
  const genderAlerts = alerts.filter(
    ({detail}) => detail.data.subcategory === GENDER_ENDING_SUBCATEGORY
  );
  if (genderAlerts.some(({detail}) => !detail.data.bulk)) return 'unsupported';
  if (!genderAlerts.length && hasFormsOutside(text, target)) return 'disabled';
  return 'nothing';
};

/**
 * What a switch does, from its check responses and the bulk alerts found,
 * looking only at the switched language's batches and alerts.
 *
 * - The API applied another format than the target: the account forces that
 *   one, and the bulk alerts convert towards it. Nothing is applied.
 * - Bulk alerts: they are applied.
 * - `bulk_actions` with "gender_format": nothing needed switching, or, coming
 *   from the Inklusivum, nothing could be (the API does not convert out of it).
 * - `bulk_actions` without it: for a German separator format, the account
 *   keeps these alerts off even though the switch asked for them. For French
 *   and the Inklusivum, an API that cannot switch there yet answers the same
 *   way, and the editor cannot tell the two apart, so it says unsupported.
 * - No `bulk_actions` (API versions up to 2.4.8): for German, the guess of
 *   `noSwitchReason`; those versions cannot switch French at all.
 */
export const decideSwitch = (
  info: SwitchCheckInfo,
  target: string,
  text: string,
  alerts: Alert[],
  {
    language = 'de',
    previous,
  }: {language?: SwitchLanguage; previous?: string} = {}
):
  | {outcome: 'switched'; apply: BulkEdit[]}
  | {outcome: 'forced'; applied: string}
  | {
      outcome: Extract<
        SwitchOutcome,
        'nothing' | 'disabled' | 'unsupported' | 'fromInklusivum'
      >;
    } => {
  const responses = info.responses.filter((response) =>
    inLanguage(response.language, language)
  );
  const applied = responses.find(
    ({separator}) => separator && separator !== target
  )?.separator;
  if (applied) return {outcome: 'forced', applied};

  const apply = bulkEdits(alerts, language);
  if (apply.length) return {outcome: 'switched', apply};

  // No text in this language was checked: nothing to switch.
  if (!responses.length) return {outcome: 'nothing'};

  const known = responses.flatMap(({bulkActions}) =>
    bulkActions ? [bulkActions] : []
  );
  if (!known.length) {
    if (language === 'fr') return {outcome: 'unsupported'};
    return {outcome: noSwitchReason(text, target, alerts)};
  }
  if (known.some((groups) => groups.includes(GENDER_FORMAT_BULK))) {
    return {
      outcome:
        previous === INKLUSIVUM && target !== INKLUSIVUM
          ? 'fromInklusivum'
          : 'nothing',
    };
  }
  return {
    outcome:
      language === 'fr' || target === INKLUSIVUM ? 'unsupported' : 'disabled',
  };
};
