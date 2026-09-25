import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {languages} from './i18n.constants';
import {de, en, fr} from './i18n.translations';
import {DEV_ENV} from '../shared/constants';

const resources = {
  [languages.en]: en,
  [languages.de]: de,
  [languages.fr]: fr,
};

if (!DEV_ENV) {
  delete resources.fr;
}

/**
 * Initialize the shared i18next instance. Called from the entry points
 * (content script, popup, options) instead of relying on side-effect imports
 * scattered across components, so future consumers of the extracted core —
 * which may run their own i18next — control when and whether this happens
 * (EDITOR_COMPONENT_PLAN.md, Phase 1 item 6). Idempotent.
 */
export const initI18n = (): void => {
  if (i18n.isInitialized) {
    return;
  }

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      detection: {
        order: ['navigator'],
      },
      resources: resources,
      fallbackLng: 'en',
    });
};

export default i18n;
