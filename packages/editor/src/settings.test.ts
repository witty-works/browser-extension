import {describe, expect, it} from 'vitest';

import {ProficiencyLevel} from '@witty/core/constants';
import type {ICategory} from '@witty/core/types';

import {
  createSettingsStore,
  languageFormatOf,
  withCategoryLevel,
  withFormatField,
} from './settings';

const genderedNouns = {
  key: 'gendered_nouns',
  advanced_key: 'gendered_nouns_advanced',
} as ICategory;

describe('settings helpers', () => {
  it('shows only the gender formats that are set', () => {
    expect(
      languageFormatOf({german_gender_ending: ':in', disabled_categories: []})
    ).toEqual({german_gender_ending: ':in'});
  });

  it('sets and clears a gender format without touching the rest', () => {
    const config = {german_gender_ending: ':in' as const, addons: ['hr']};

    expect(withFormatField(config, 'french_gender_separator', '·')).toEqual({
      ...config,
      french_gender_separator: '·',
    });
    // Cleared, not set to '': the account setting applies again.
    expect(withFormatField(config, 'german_gender_ending', '')).toEqual({
      addons: ['hr'],
    });
  });

  it('switches a category and its advanced key together', () => {
    const off = withCategoryLevel({}, genderedNouns, ProficiencyLevel.Off);
    expect(off.disabled_categories).toEqual(
      expect.arrayContaining(['gendered_nouns', 'gendered_nouns_advanced'])
    );

    const basic = withCategoryLevel(off, genderedNouns, ProficiencyLevel.Basic);
    expect(basic.disabled_categories).toEqual(['gendered_nouns_advanced']);

    const advanced = withCategoryLevel(
      basic,
      genderedNouns,
      ProficiencyLevel.Advanced
    );
    expect(advanced.disabled_categories).toEqual([]);
  });

  it('notifies subscribers of every change', () => {
    const store = createSettingsStore({
      config: {},
      llmAlternatives: false,
      orthography: true,
    });
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.get().llmAlternatives));

    store.set({llmAlternatives: true});

    expect(seen).toEqual([true]);
    expect(store.get().orthography).toBe(true);
  });
});
