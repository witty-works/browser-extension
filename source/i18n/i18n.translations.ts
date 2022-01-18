import { namespaces } from "./i18n.constants";

export const de = {
  [namespaces.common]: {
    buttons: {
      ok: "Akzeptieren",
      cancel: "Abbrechen",
    },
    languages: {
      en_US: 'Englisch (🇺🇸 USA)',
      en_GB: 'Englisch (🇬🇧 Vereinigtes Königreich)',
      de_DE: 'Deutsch (🇩🇪 Deutschland)',
      de_AT: 'Deutsch (🇦🇹 Österreich)',
      de_CH: 'Deutsch (🇨🇭 Schweiz)',
    },
  },
  [namespaces.pages.popup]: {
    settings: "Einstellungen",
    enableWitty: 'Witty aktivieren',
    primaryLanguage: 'Primäre Sprache',
    preferredLanguage: 'Gewünschte Sprache',
    germanGenderEnding: 'Inklusive Geschlechter-Nennung',
    developmentSettings: "Entwicklungs-Einstellungen",
    apiEndpoint: 'API Endpunkt',
    needHelpQuestionMark: 'Brauchen Sie Hilfe?'
  },
  [namespaces.modal]: {
    insteadTry: 'Stattdessen könnten Sie versuchen...', //TODO
    howToImprove: 'Wie kann ich das verbessern?', //TODO
    ignoreTerm: 'Begriff ignorieren', //TODO
    whyQuestionMark: 'Warum?',
    understood: 'Verstanden',
    okUnderstood: 'Ok, Verstanden!',
  },
};

export const en = {
  [namespaces.common]: {
    buttons: {
      ok: "Ok",
      cancel: "Cancel",
    },
    languages: {
      en_GB: 'English (🇬🇧 Great Britain)',
      en_US: 'English (🇺🇸 USA)',
      de_AT: 'German (🇦🇹 Austrian)',
      de_DE: 'German (🇩🇪 Germany)',
      de_CH: 'German (🇨🇭 Switzerland)',
    },
  },
  [namespaces.pages.popup]: {
    settings: "Settings",
    enableWitty: 'Enable Witty',
    primaryLanguage: 'Primary Language',
    preferredLanguage: 'Preferred Language',
    germanGenderEnding: 'German Gender Ending',
    developmentSettings: "Development Settings",
    apiEndpoint: 'API Endpoint',
    needHelpQuestionMark: 'Need Help?'
  },
  [namespaces.modal]: {
    insteadTry: 'Try one of these instead...',
    howToImprove: 'How to improve it yourself',
    ignoreTerm: 'Ignore this term',
    whyQuestionMark: 'Why?',
    understood: 'Understood',
    okUnderstood: 'Ok, Understood!',
  },
};
