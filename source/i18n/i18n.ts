import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';
import { languages } from "./i18n.constants";
import { de, en, fr } from "./i18n.translations";
import { DEV_ENV } from '../shared/constants';

let resources = {
  [languages.en]: en,
  [languages.de]: de,
  [languages.fr]: fr,
}

if (!DEV_ENV) {
  delete resources.fr
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    detection: {
      order: ['navigator']
    },
    resources: resources,
    fallbackLng: 'en'
  });

export default i18n;