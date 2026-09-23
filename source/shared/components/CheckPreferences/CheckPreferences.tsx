import React from 'react';
import {useTranslation} from 'react-i18next';

import {namespaces} from '../../../i18n/i18n.constants';
import {
  CONFIG_OPTION_FIELDS,
  levelFromDisabled,
  LOCKED_PROFICIENCY,
  ProficiencyLevel,
} from '../../constants';
import {ICategory, ICategoryGroup, IConfigOption} from '../../types';
import CategoryToggle from './CategoryToggle';
import './CheckPreferences.scss';

export interface CheckPreferencesProps {
  /** Witty checks spelling, so the browser's own spellcheck is switched off. */
  orthography: boolean;
  onOrthographyChange: (enabled: boolean) => void;
  /** Offer the LLM's sentence rewrites in the popover. */
  llmAlternatives: boolean;
  onLlmAlternativesChange: (enabled: boolean) => void;
  /** From `GET /v2.0/config-options`; the format section needs it. */
  configOptions: Record<string, IConfigOption>;
  /** Chosen gender formats; a field absent here uses the API's default. */
  languageFormat: Record<string, string>;
  /** `''` clears the field, so the API default applies again. */
  onFormatFieldChange: (field: string, value: string) => void;
  /** From `GET /v2.0/categories`; the categories section needs them. */
  categories: ICategory[];
  categoryGroups: ICategoryGroup[];
  disabledCategories: string[];
  onCategoryLevelChange: (category: ICategory, level: ProficiencyLevel) => void;
  /** The category list could not be loaded. */
  categoriesError?: boolean;
  /** Prefix for element ids, for a host that renders more than one. */
  idPrefix?: string;
}

const FORMAT_LABEL_KEYS: Record<string, string> = {
  gendered_roles_format: 'genderedRolesFormat',
  german_gender_ending: 'germanGenderEnding',
  french_gender_separator: 'frenchGenderSeparator',
};

/**
 * The check preferences a user can set: spelling, AI suggestions, gender
 * formats and categories. Presentational only — the host owns the values and
 * where they are kept (extension storage for the options page, the editor
 * component's request config for its settings panel).
 */
const CheckPreferences: React.FC<CheckPreferencesProps> = ({
  orthography,
  onOrthographyChange,
  llmAlternatives,
  onLlmAlternativesChange,
  configOptions,
  languageFormat,
  onFormatFieldChange,
  categories,
  categoryGroups,
  disabledCategories,
  onCategoryLevelChange,
  categoriesError = false,
  idPrefix = '',
}: CheckPreferencesProps) => {
  const {t} = useTranslation(namespaces.options);

  /**
   * Human label for a value, from the API, which serves the dashboard's own
   * wording. Values without one (punctuation such as `(-)`) fall back to the
   * value itself, which reads fine untranslated.
   */
  const formatValueLabel = (field: string, value: string): string =>
    configOptions[field]?.labels?.[value] || value;

  return (
    <>
      <section>
        <h2>{t('customisationHeadline')}</h2>
        <p className='witty-options-muted'>{t('orgOverrideNote')}</p>

        <label>
          <input
            type='checkbox'
            id={`${idPrefix}opt-orthography`}
            checked={orthography}
            onChange={(event) => onOrthographyChange(event.target.checked)}
          />
          &nbsp;{t('orthography')}
        </label>

        <label>
          <input
            type='checkbox'
            id={`${idPrefix}opt-llm-alternatives`}
            checked={llmAlternatives}
            onChange={(event) => onLlmAlternativesChange(event.target.checked)}
          />
          &nbsp;{t('llmAlternatives')}
        </label>
      </section>

      {/*
        Rendered from whatever the server reported. A deployment that reports
        nothing simply does not offer the section.
      */}
      {Object.keys(configOptions).length > 0 && (
        <section id={`${idPrefix}language-format-section`}>
          <h2>{t('languageHeadline')}</h2>
          <p className='witty-options-muted'>{t('orgOverrideNote')}</p>

          {CONFIG_OPTION_FIELDS.filter((field) => configOptions[field]).map(
            (field) => {
              const option = configOptions[field];
              const labelKey = FORMAT_LABEL_KEYS[field];

              return (
                <div className='witty-format-field' key={field}>
                  <label htmlFor={`${idPrefix}opt-${field}`}>
                    {t(labelKey)}
                  </label>
                  <p className='witty-options-muted'>{t(`${labelKey}Hint`)}</p>
                  <select
                    id={`${idPrefix}opt-${field}`}
                    data-field={field}
                    value={languageFormat[field] || ''}
                    onChange={(event) =>
                      onFormatFieldChange(field, event.target.value)
                    }
                  >
                    <option value=''>
                      {t('useApiDefault')}
                      {option.default ? ` (${option.default})` : ''}
                    </option>
                    {option.values.map((value) => (
                      <option value={value} key={value}>
                        {formatValueLabel(field, value)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
          )}
        </section>
      )}

      {categories.length > 0 && (
        <section id={`${idPrefix}categories-section`}>
          <h2>{t('categoriesHeadline')}</h2>
          <p className='witty-options-muted'>{t('categoriesIntro')}</p>

          {categoryGroups.map((group) => {
            const inGroup = categories.filter(
              (category) => category.parent === group.key
            );
            if (!inGroup.length) {
              return null;
            }

            return (
              <div className='witty-category-group' key={group.key}>
                <h3>{group.label || group.key}</h3>
                {inGroup.map((category) => (
                  <CategoryToggle
                    key={category.key}
                    categoryKey={category.key}
                    label={category.label || category.key}
                    hasAdvanced={!!category.advanced_key}
                    locked={category.proficiency_level === LOCKED_PROFICIENCY}
                    value={levelFromDisabled(
                      category.key,
                      category.advanced_key,
                      disabledCategories
                    )}
                    onChange={(level) => onCategoryLevelChange(category, level)}
                  />
                ))}
              </div>
            );
          })}
        </section>
      )}

      {categoriesError && (
        <p className='witty-options-muted'>{t('categoriesFailed')}</p>
      )}
    </>
  );
};

export default CheckPreferences;
