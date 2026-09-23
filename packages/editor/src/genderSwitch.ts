import type {EditorState, Transaction} from '@tiptap/pm/state';

import type {CheckConfig} from './checkClient';
import type {Alert} from './checkPlugin';

/**
 * Switching a text's German gender format in one step, driven by the API's
 * bulk alerts (EDITOR: "Switch gender format…" in the W menu).
 *
 * With `config.german_gender_ending` set to the target, the NLP API marks every
 * gendered form written in another format with `bulk: "gender_format"` and
 * gives it exactly one alternative, the same form in the target format. The
 * alerts never overlap, and accepting all of them is the switch. Only `bulk`
 * decides what is applied; older API versions have the same subcategory but
 * convert incompletely (articles and determiners were skipped).
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
  /** Not a format the API can switch to (the Inklusivum, for now). */
  | 'unavailable';

export interface GenderFormatSwitchResult {
  outcome: SwitchOutcome;
  target: string;
  /** Forms rewritten. */
  count: number;
  /** Part of the text was not checked, so it may hold unswitched forms. */
  limitReached: boolean;
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

/**
 * The alerts a switch applies: marked for the bulk action, with exactly the
 * one alternative the contract promises. Anything else is left one-by-one.
 */
export const bulkAlerts = (
  alerts: Alert[],
  group = GENDER_FORMAT_BULK
): Alert[] =>
  alerts.filter(
    ({detail}) =>
      detail.data.bulk === group &&
      detail.data.alternatives?.length === 1 &&
      typeof detail.data.alternatives[0].text === 'string'
  );

/** Accept every alert in one transaction, so a single undo reverses it. */
export const applyAlerts = (
  state: EditorState,
  alerts: Alert[]
): Transaction => {
  const tr = state.tr;
  // Back to front, so earlier positions stay valid.
  for (const alert of [...alerts].sort((a, b) => b.from - a.from)) {
    tr.insertText(alert.detail.data.alternatives[0].text, alert.from, alert.to);
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
 * Why a switch rewrote nothing. `alerts` are the switch check's results.
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
