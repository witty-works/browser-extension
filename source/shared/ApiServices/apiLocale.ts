/**
 * The `locale` the NLP API's public endpoints accept (`/v2.0/categories`,
 * `/v2.0/config-options`), shared by the extension's options page and the
 * editor. Anything else is refused with a 422.
 *
 * Both functions return only the string literals below, never text derived
 * from their input, so what the browser reports cannot reach a request URL.
 */

export type ApiLanguage = 'de' | 'en' | 'fr';

export type ApiLocale =
  'de-DE' | 'de-CH' | 'de-AT' | 'en-US' | 'en-GB' | 'fr-FR' | ApiLanguage;

/** The language of a locale the API accepts: `de-CH` gives `de`. */
export const apiLanguage = (language: string | undefined): ApiLanguage => {
  switch ((language ?? '').toLowerCase().split('-')[0]) {
    case 'de':
      return 'de';
    case 'fr':
      return 'fr';
    default:
      return 'en';
  }
};

/**
 * The browser's language as a locale the API accepts: the variant itself if
 * it knows it (`de-CH`), else its language (`fr-CH` gives `fr`), else English.
 */
export const apiLocale = (language: string | undefined): ApiLocale => {
  switch ((language ?? '').toLowerCase()) {
    case 'de-de':
      return 'de-DE';
    case 'de-ch':
      return 'de-CH';
    case 'de-at':
      return 'de-AT';
    case 'en-us':
      return 'en-US';
    case 'en-gb':
      return 'en-GB';
    case 'fr-fr':
      return 'fr-FR';
    default:
      return apiLanguage(language);
  }
};
