import type {EditorState, Transaction} from '@tiptap/pm/state';

import type {CheckConfig} from './checkClient';
import type {Alert} from './checkPlugin';

/**
 * Switching a text's German gender format in one step, driven by the API's
 * bulk alerts (EDITOR: "Switch gender format…" in the W menu).
 *
 * With `config.german_gender_ending` set to the target, the NLP API marks with
 * `bulk: "gender_format"` every gendered form written in another format, every
 * role in the generic masculine, and the pair formulas it recognises. Each
 * names the alternative to apply in `bulk_alternative` (a separator mismatch
 * has exactly one; older API versions leave the index out for those). The
 * alerts never overlap, and accepting all of them, in any order, is the
 * switch. Only `bulk` decides what is applied; older API versions have the
 * same subcategory but convert incompletely (articles and determiners were
 * skipped).
 */

export const GENDER_FORMAT_BULK = 'gender_format';

type GenderEnding = NonNullable<CheckConfig['german_gender_ending']>;

/** The separator formats the API converts between, in its own order. */
export const SWITCHABLE_FORMATS: GenderEnding[] = [
  '/in',
  '/-in',
  '_in',
  '*in',
  ':in',
  '(-)',
  '()',
  'In',
];

/** The Inklusivum: converting into or out of it is not supported by the API yet. */
export const INKLUSIVUM: GenderEnding = 'de-e';

/** The subcategory holding the gender-format alerts. */
const GENDER_ENDING_SUBCATEGORY = 'gendered_denominations_ending_advanced';

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
  /** Not a format the API can switch to (the Inklusivum, for now). */
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

/** What a switch's check responses said about the request. */
export interface SwitchCheckInfo {
  /** The format the API applied (`gender_separator`), per German response. */
  separators: string[];
  /** `bulk_actions` per response; `undefined` where the API sent none. */
  bulkActions: (string[] | undefined)[];
}

/**
 * The config for the switch's check: the target format, and the gender-format
 * alerts switched on even where the user turned them off. The user's own
 * settings are not changed; `needed` says whether this differed from them.
 */
export const switchRequestConfig = (
  config: CheckConfig,
  target: GenderEnding
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
      german_gender_ending: target,
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
 * bulk action. Anything else is left one-by-one.
 */
export const bulkEdits = (
  alerts: Alert[],
  group = GENDER_FORMAT_BULK
): BulkEdit[] =>
  alerts.flatMap(({from, to, detail}) => {
    if (detail.data.bulk !== group) return [];
    const text = bulkAlternative(detail.data);
    return text === null ? [] : [{from, to, text}];
  });

/** Make every edit in one transaction, so a single undo reverses it. */
export const applyEdits = (
  state: EditorState,
  edits: BulkEdit[]
): Transaction => {
  const tr = state.tr;
  // Back to front, so earlier positions stay valid.
  for (const {from, to, text} of [...edits].sort((a, b) => b.from - a.from)) {
    tr.insertText(text, from, to);
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
 * What a switch does, from its check responses and the bulk alerts found.
 *
 * - The API applied another format than the target: the account forces that
 *   one, and the bulk alerts convert towards it. Nothing is applied.
 * - Bulk alerts: they are applied.
 * - `bulk_actions` without "gender_format": the account keeps these alerts
 *   off, even though the switch asked for them.
 * - `bulk_actions` with it: nothing needed switching.
 * - No `bulk_actions` (API versions up to 2.4.8): the guess of
 *   `noSwitchReason`.
 */
export const decideSwitch = (
  info: SwitchCheckInfo,
  target: string,
  text: string,
  alerts: Alert[]
):
  | {outcome: 'switched'; apply: BulkEdit[]}
  | {outcome: 'forced'; applied: string}
  | {
      outcome: Extract<SwitchOutcome, 'nothing' | 'disabled' | 'unsupported'>;
    } => {
  const applied = info.separators.find((separator) => separator !== target);
  if (applied) return {outcome: 'forced', applied};
  const apply = bulkEdits(alerts);
  if (apply.length) return {outcome: 'switched', apply};
  const known = info.bulkActions.filter(
    (groups): groups is string[] => groups !== undefined
  );
  if (!known.length) return {outcome: noSwitchReason(text, target, alerts)};
  return {
    outcome: known.some((groups) => groups.includes(GENDER_FORMAT_BULK))
      ? 'nothing'
      : 'disabled',
  };
};
