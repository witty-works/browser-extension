import type {Editor} from '@tiptap/core';

import type {EditorStatus} from './api';
import type {CheckConfig, CheckLang, ICheckResponse} from './checkClient';
import {
  getAlerts,
  getTextLanguages,
  isLimitReached,
  requestRecheck,
} from './checkPlugin';
import {type CheckWaiters, EditorDestroyedError} from './checkWaiters';
import {
  applyEdits,
  decideSwitch,
  FORMAT_FIELD,
  formatLanguage,
  GENDER_FORMAT_BULK,
  type GenderFormatSwitchResult,
  INKLUSIVUM,
  SWITCHABLE_FORMATS,
  type SwitchCheckInfo,
  type SwitchLanguage,
  switchRequestConfig,
} from './genderSwitch';
import type {SettingsStore, StatusStore} from './settings';
import {formatLabel, type PreferenceOptions} from './preferenceOptions';

/** Marks the switch's own edit, which must not clear its message. */
export const SWITCH_META = 'wittyGenderFormatSwitch';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** What a switch did, in words; shared by the panel and the live region. */
export const switchMessage = (
  t: Translate,
  result: GenderFormatSwitchResult,
  options: PreferenceOptions | null
): string => {
  const format = formatLabel(options, result.target);
  const text = {
    switched: t('switched', {count: result.count, format}),
    nothing: t('switchNothing', {format}),
    fromInklusivum: t('switchFromInklusivum'),
    disabled: t('switchDisabled'),
    unsupported: t('switchUnsupportedTarget', {format}),
    unavailable: t('switchUnavailable', {format}),
    forced: t('switchForced', {
      format: formatLabel(options, result.applied ?? ''),
    }),
  }[result.outcome];
  // What was checked is switched; the rest may still hold other forms.
  return result.limitReached &&
    (result.outcome === 'switched' || result.outcome === 'nothing')
    ? `${text} ${t('limitReached')}`
    : text;
};

export interface SwitchControllerOptions {
  editor: Editor;
  settings: SettingsStore;
  status: StatusStore;
  waiters: CheckWaiters;
  loadOptions: () => Promise<PreferenceOptions>;
  t: Translate;
  /** The host's `lang`: a fixed German or French decides the formats offered. */
  lang: CheckLang;
  onStatus?: (status: EditorStatus) => void;
  /** Whether `destroy()` was called; nothing touches the editor after it. */
  destroyed: () => boolean;
}

export interface SwitchController {
  /** The config for requests while a switch runs; `null` otherwise. */
  requestConfig(): CheckConfig | null;
  /**
   * Called as a check request goes out; the returned function takes its
   * response. Only requests sent while a switch runs count as its own: a
   * response to an earlier one says nothing about the switch's config.
   */
  request(): (response: ICheckResponse) => void;
  /** `WittyEditorHandle.switchGenderFormat`: one at a time, queued. */
  switchGenderFormat(target: string): Promise<GenderFormatSwitchResult>;
  /** Whether the API can switch (to `target`), as far as known. */
  supported(target?: string): boolean;
  /**
   * The languages whose formats "Switch gender format…" offers: the host's
   * `lang` if it fixed German or French, otherwise German and French as far
   * as the API found them in the text, most of the text first. A text in
   * neither (or not checked yet) gets both.
   */
  languages(): SwitchLanguage[];
}

/**
 * "Switch gender format…" and `switchGenderFormat`: sets the target format,
 * checks the whole text with the gender-format alerts on, and applies the
 * bulk alerts in one undoable transaction (see genderSwitch.ts for what is
 * applied and why).
 */
export const createSwitchController = ({
  editor,
  settings,
  status,
  waiters,
  loadOptions,
  t,
  lang,
  onStatus,
  destroyed,
}: SwitchControllerOptions): SwitchController => {
  // While a switch runs, its checks use this config instead: the user's, with
  // the gender-format alerts switched on. Never stored.
  let switchConfig: CheckConfig | null = null;
  // What the switch's own check responses said; collected while it runs.
  let switchInfo: SwitchCheckInfo | null = null;
  // Whether the API has bulk actions: every response of one that has says so
  // (`bulk_actions`); a switch can also find an API that predates them.
  let bulkSupport: 'unknown' | 'yes' | 'no' = 'unknown';
  // Targets a switch found the API cannot convert to yet (`bulk_actions`
  // without "gender_format" for French or the Inklusivum).
  const unsupportedTargets = new Set<string>();
  let switching: Promise<GenderFormatSwitchResult> | null = null;

  /** Report `result` in the live region and to the host. */
  const announce = async (result: GenderFormatSwitchResult): Promise<void> => {
    const options = await loadOptions().catch(() => null);
    if (destroyed()) return;
    status.set({notice: switchMessage(t, result, options)});
    onStatus?.({
      state: 'idle',
      alerts: getAlerts(editor.state).length,
      limitReached: isLimitReached(editor.state),
      genderFormatSwitch: result,
    });
  };

  const markUnsupported = (
    language: SwitchLanguage,
    info: SwitchCheckInfo
  ): void => {
    // An API without bulk actions at all, or one that cannot switch to this
    // target yet: then the other targets it can't either.
    const knowsBulkActions = info.responses.some(
      ({bulkActions}) => bulkActions
    );
    if (!knowsBulkActions && language === 'de') bulkSupport = 'no';
    if (knowsBulkActions || language === 'fr') {
      const targets = language === 'fr' ? SWITCHABLE_FORMATS.fr : [INKLUSIVUM];
      targets.forEach((format) => unsupportedTargets.add(format));
    }
  };

  const runSwitch = async (
    target: string
  ): Promise<GenderFormatSwitchResult> => {
    if (destroyed()) throw new EditorDestroyedError();
    const language = formatLanguage(target);
    if (!language) {
      return {outcome: 'unavailable', target, count: 0, limitReached: false};
    }

    // 1. The target becomes the configured format of its language (the
    //    toolbar shows it; the other language's stays), and the switch's
    //    checks ask for the gender-format alerts regardless of the user's
    //    category settings, which stay as they are.
    const field = FORMAT_FIELD[language];
    const previousConfig = settings.get().config;
    const userConfig: CheckConfig = {...previousConfig, [field]: target};
    switchConfig = switchRequestConfig(userConfig, target, language).config;
    const info: SwitchCheckInfo = {responses: []};
    switchInfo = info;
    const checked = waiters.next();
    settings.set({config: userConfig});
    // Also clears the sentence cache: only fresh responses say which format
    // the API applied.
    requestRecheck(editor.view);

    let limitReached: boolean;
    try {
      // 2. Every batch of the text, not only the first.
      limitReached = await checked;
    } catch (error) {
      // The check failed (refused key, timeout) or the editor went away: the
      // switch did not happen, so neither does its setting.
      if (!destroyed()) {
        settings.set({config: previousConfig});
        requestRecheck(editor.view);
      }
      throw error;
    } finally {
      switchConfig = null;
      switchInfo = null;
    }

    // 3. All bulk alerts in one transaction: one undo restores the text. Not
    //    when the account forces another format: they would convert to that.
    const decision = decideSwitch(
      info,
      target,
      editor.state.doc.textContent,
      getAlerts(editor.state),
      {language, previous: previousConfig[field]}
    );
    let result: GenderFormatSwitchResult;
    if (decision.outcome === 'switched') {
      editor.view.dispatch(
        applyEdits(editor.state, decision.apply).setMeta(SWITCH_META, true)
      );
      result = {
        outcome: 'switched',
        target,
        count: decision.apply.length,
        limitReached,
      };
    } else if (decision.outcome === 'forced') {
      // The setting would not take effect either.
      settings.set({config: previousConfig});
      result = {
        outcome: 'forced',
        target,
        count: 0,
        limitReached,
        applied: decision.applied,
      };
    } else {
      if (decision.outcome === 'unsupported') markUnsupported(language, info);
      result = {outcome: decision.outcome, target, count: 0, limitReached};
    }
    // Back to the user's own settings for the underlines.
    requestRecheck(editor.view);

    // 4. Said in the live region and to the host.
    await announce(result);
    return result;
  };

  return {
    requestConfig: (): CheckConfig | null => switchConfig,
    request: (): ((response: ICheckResponse) => void) => {
      const info = switchInfo;
      return (response: ICheckResponse): void => {
        if (
          response.bulk_actions ||
          response.results?.some((result) => result.bulk === GENDER_FORMAT_BULK)
        ) {
          bulkSupport = 'yes';
        }
        info?.responses.push({
          language: response.language,
          separator: response.gender_separator,
          bulkActions: response.bulk_actions,
        });
      };
    },
    switchGenderFormat: (target: string): Promise<GenderFormatSwitchResult> => {
      // One at a time: a second request waits for the running one.
      switching = (switching ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => runSwitch(target));
      return switching;
    },
    supported: (target?: string): boolean =>
      bulkSupport !== 'no' && !(target && unsupportedTargets.has(target)),
    languages: (): SwitchLanguage[] => {
      const fixed = lang.slice(0, 2);
      if (fixed === 'de' || fixed === 'fr') return [fixed];
      const found = getTextLanguages(editor.state);
      const present = (['de', 'fr'] as const)
        .filter((language) => found[language])
        .sort((a, b) => found[b] - found[a]);
      return present.length ? present : ['de', 'fr'];
    },
  };
};
