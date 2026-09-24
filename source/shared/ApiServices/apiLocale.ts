/**
 * The `locale` the NLP API's public endpoints accept (`/v2.0/categories`,
 * `/v2.0/config-options`), shared by the extension's options page and the
 * editor.
 */
/** The `locale` values the API accepts on these endpoints. */
const API_LOCALES = [
  'de-DE',
  'de-CH',
  'de-AT',
  'en-US',
  'en-GB',
  'fr-FR',
  'de',
  'en',
  'fr',
] as const;
type ApiLocale = (typeof API_LOCALES)[number];

/**
 * The browser's language as a locale the API accepts: the variant itself if
 * it knows it (`de-CH`), else its language (`fr-CH` gives `fr`), else English.
 * Anything else would be refused with a 422, and only these values ever reach
 * the request URL.
 */
export const apiLocale = (language: string | undefined): ApiLocale => {
  const known = (candidate: string): ApiLocale | undefined =>
    API_LOCALES.find((locale) => locale.toLowerCase() === candidate);
  const lower = (language ?? '').toLowerCase();
  return known(lower) ?? known(lower.split('-')[0]) ?? 'en';
};
