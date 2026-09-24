import {
  categoriesPath,
  CONFIG_OPTIONS_PATH,
  JSON_HEADERS,
} from '@witty/core/ApiServices/requests';
import type {
  ICategoriesResponse,
  ICategory,
  ICategoryGroup,
  IConfigOption,
  IConfigOptionsResponse,
} from '@witty/core/types';

import {apiLocale} from '@witty/core/ApiServices/apiLocale';

import {FORMAT_FIELD, formatLanguage} from './genderSwitch';

/**
 * What the settings and gender format panels offer: the API's categories and
 * config options (gender formats with their labels), loaded as the extension's
 * options page loads them.
 */

export interface ApiOptions {
  endpoint: string;
  headers: () => Record<string, string>;
}

export interface PreferenceOptions {
  categories: ICategory[];
  categoryGroups: ICategoryGroup[];
  configOptions: Record<string, IConfigOption>;
  categoriesError: boolean;
  /** The gender formats could not be loaded: labels fall back to values. */
  configOptionsError: boolean;
}

/**
 * Category list and gender-format options, as the options page loads them.
 * Both endpoints are public, so this works before a key is entered.
 */
const loadPreferenceOptions = async (
  api: ApiOptions
): Promise<PreferenceOptions> => {
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(`${api.endpoint}${path}`, {
      headers: {...JSON_HEADERS, ...api.headers()},
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  };

  const locale = apiLocale(navigator.language);
  const [categories, options] = await Promise.allSettled([
    get(categoriesPath(locale)),
    // Labels in the UI's language; APIs up to 2.4.8 refuse `locale`.
    get(`${CONFIG_OPTIONS_PATH}?locale=${locale.split('-')[0]}`).catch(() =>
      get(CONFIG_OPTIONS_PATH)
    ),
  ]);
  const list =
    categories.status === 'fulfilled'
      ? (categories.value as ICategoriesResponse)
      : undefined;

  return {
    categories: list?.categories || [],
    categoryGroups: list?.groups || [],
    categoriesError: !list,
    configOptions:
      options.status === 'fulfilled'
        ? (options.value as IConfigOptionsResponse).options || {}
        : {},
    configOptionsError: options.status !== 'fulfilled',
  };
};

/**
 * Loads the options once per editor, on first use. A load that failed, for the
 * categories or the gender formats, is tried again the next time.
 */
export const createOptionsLoader = (
  api: ApiOptions
): (() => Promise<PreferenceOptions>) => {
  let cached: Promise<PreferenceOptions> | undefined;
  return (): Promise<PreferenceOptions> => {
    cached ??= loadPreferenceOptions(api).then((options) => {
      if (options.categoriesError || options.configOptionsError) {
        cached = undefined;
      }
      return options;
    });
    return cached;
  };
};

/** Human label of a gender format, German or French, as the settings panel shows it. */
export const formatLabel = (
  options: PreferenceOptions | null,
  value: string
): string => {
  const language = formatLanguage(value);
  const field = language ? FORMAT_FIELD[language] : 'german_gender_ending';
  return options?.configOptions[field]?.labels?.[value] || value;
};
