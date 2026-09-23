import {applyLevelToDisabled, ProficiencyLevel} from '@witty/core/constants';
import type {ICategory} from '@witty/core/types';

import type {CheckConfig} from './checkClient';

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

/** A value React components and plain code can both read and watch. */
export interface Store<T> {
  get(): T;
  set(next: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

export type SettingsStore = Store<EditorSettings>;

export const createStore = <T extends object>(initial: T): Store<T> => {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: (): T => value,
    set(next): void {
      value = {...value, ...next};
      listeners.forEach((listener) => listener());
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
};

export const createSettingsStore = (initial: EditorSettings): SettingsStore =>
  createStore(initial);

/** What the Witty button shows and the live region announces. */
export type CheckStatus =
  | {state: 'checking'}
  | {state: 'idle'; alerts: number; limitReached: boolean}
  | {state: 'unauthorized'}
  | {state: 'error'; message: string};

export type StatusStore = Store<{status: CheckStatus}>;

type FormatField = keyof Pick<
  CheckConfig,
  'gendered_roles_format' | 'german_gender_ending' | 'french_gender_separator'
>;

/** The gender formats set in `config`, as the preferences UI shows them. */
export const languageFormatOf = (
  config: CheckConfig
): Record<string, string> => {
  const format: Record<string, string> = {};
  for (const field of [
    'gendered_roles_format',
    'german_gender_ending',
    'french_gender_separator',
  ] as FormatField[]) {
    const value = config[field];
    if (value) format[field] = value;
  }
  return format;
};

/**
 * `config` with a gender format chosen, or cleared with `''` so the account's
 * setting (or the API default) applies again.
 */
export const withFormatField = (
  config: CheckConfig,
  field: string,
  value: string
): CheckConfig => {
  const next: Record<string, unknown> = {...config};
  if (value) {
    next[field] = value;
  } else {
    delete next[field];
  }
  return next as CheckConfig;
};

/** `config` with `category` switched to `level`, by the extension's rule. */
export const withCategoryLevel = (
  config: CheckConfig,
  category: ICategory,
  level: ProficiencyLevel
): CheckConfig => {
  return {
    ...config,
    disabled_categories: applyLevelToDisabled(
      category.key,
      category.advanced_key,
      level,
      config.disabled_categories ?? []
    ),
  };
};
