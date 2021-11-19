import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';
import { languages } from "./i18n.constants";
import { de, en } from "./i18n.translations";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    detection: {
      order: ['navigator']
    },
    resources: {
      [languages.en]: en,
      [languages.de]: de,
    },
    fallbackLng: 'en'
  });

export default i18n;