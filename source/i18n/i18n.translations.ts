import { namespaces } from './i18n.constants';

export const de = {
  [namespaces.common]: {
    buttons: {
      ok: 'Akzeptieren',
      cancel: 'Abbrechen',
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
    settings: 'Aktuelle Webseite',
    enableWitty: 'Witty aktivieren',
    globalSettings: 'Globale Einstellungen',
    websiteSettings: 'Aktuelle Webseite',
    caseSensitivity: 'Gross- und Kleinschreibung',
    primaryLanguage: 'Primäre Sprache',
    preferredLanguage: 'Ich bevorzuge',
    germanGenderEnding: 'Wähle die deutsche Gender-Endung',
    developmentSettings: 'Entwicklungs-Einstellungen',
    apiEndpoint: 'API Endpunkt',
    needHelpQuestionMark: 'Brauchen Sie Hilfe?',
    spellChecking: 'Grammatik & Rechtschreibung',
    inclusiveTerms: 'Inklusive Begriffe',
    styleCorrections: 'Stilvorschläge',
    styleCorrectionExplanation:
      'Wenn eingeschaltet macht Witty Vorschläge, um Ihren Text verständlicher zu machen, oder um ihm Authentizität oder Emotionalität zu verleihen.',
    inclusiveLanguageExplanation:
      'Wenn aktiviert, unterstreicht Witty auch inklusive Begriffe. Bei diesen werden keine Alternativen angeboten.',
  },
  [namespaces.popover]: {
    insteadTry: "Wie wär's mit ...",
    learnMorePositive: 'Warum?',
    learnMoreNegative: 'Warum?',
    ignoreTerm: 'Ignorieren',
    whyQuestionMark: 'Warum?',
    alertOftotal: 'von',
    removeSpaces: 'Extra Leerzeichen entfernen',
  },
  [namespaces.pages.options]: {
    settings: 'Einstellungen',
    needHelp: 'Brauchst du Hilfe?',
    getMoreTitle: 'WITTY KANN NOCH VIEL MEHR!',
    getMoreText: 'Upgraden, um eigene Regeln zu verwalten und zu teilen!',
    getMoreButton: 'Upgraden',
    enableWitty: 'Witty aktivieren',
    setUpLanguages: 'Spracheinstellungen',
    configureRules: 'Witty Regeln anpassen',
    disableWitty: 'Witty auf gewissen Webseiten deaktivieren',
    expertMode: 'Weniger schwerwiegende Probleme hervorheben',
    expertModeExplanation:
      'Wenn aktiviert, macht Witty auch bei weniger schwerwiegenden Probleme in Bezug auf Diversität und Inklusion Vorschläge.',
    inspirationAlternatives:
      'Inspirationen zur Umformulierung ganzer Sätze zeigen',
    inspirationAlternativesExplanation:
      'Wenn aktiviert, macht Witty Vorschläge zur Umformulierung ganzer Sätze.',
    singularThey: 'Im Englischen geschlechtsneutrale Pronomen vorschlagen',
    singularTheysExplanation:
      'Wenn aktiviert, schlägt Witty im Englischen geschlechtsneutrale Pronomen vor, z. B. "their" anstelle von "his" oder "her".',
    addSite: 'Geben sie eine Webseite ein',
    invalidDomain: 'Bitte geben sie die Webseiten im Format "google.com" ein.',
    addDomain: 'Webseite hinzufügen',
    inclusiveLanguageExplanation:
      'Wenn aktiviert, unterstreicht Witty auch inklusive Begriffe. Bei diesen werden keine Alternativen angeboten.',
    styleCorrectionExplanation:
      'Wenn aktiviert, macht Witty Vorschläge, um Ihren Text verständlicher zu machen, oder um ihm Authentizität oder Emotionalität zu verleihen.',
  },
};

export const en = {
  [namespaces.common]: {
    buttons: {
      ok: 'Ok',
      cancel: 'Cancel',
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
    settings: 'Current Website',
    enableWitty: 'Enable Witty',
    globalSettings: 'Global settings',
    websiteSettings: 'Current website',
    caseSensitivity: 'Case-sensitive checks',
    primaryLanguage: 'Primary Language',
    preferredLanguage: 'I write in',
    germanGenderEnding: 'Choose the German gender ending',
    developmentSettings: 'Development Settings',
    apiEndpoint: 'API Endpoint',
    needHelpQuestionMark: 'Need Help?',
    spellChecking: 'Check grammar & spelling',
    inclusiveTerms: 'Check inclusive terms',
    styleCorrections: 'Check style issues',
    styleCorrectionExplanation:
      'Turn this off to ignore stylistic not severe issues to be highlighted',
    inclusiveLanguageExplanation:
      'When this feature is active, each time you use an inclusive term correctly, witty will highlight it in green',
  },
  [namespaces.popover]: {
    insteadTry: 'Try instead ...',
    learnMorePositive: 'Why?',
    learnMoreNegative: 'Why?',
    ignoreTerm: 'Ignore',
    whyQuestionMark: 'Why?',
    alertOftotal: 'of',
    removeSpaces: '(Remove extra spaces)',
  },
  [namespaces.pages.options]: {
    settings: 'Settings',
    needHelp: 'Need Help?',
    getMoreTitle: 'GET MUCH MORE FROM WITTY!',
    getMoreText:
      'Upgrade and get access to more checks, custom rules, and much more!',
    getMoreButton: 'Upgrade now',
    enableWitty: 'Enable Witty',
    setUpLanguages: 'Language settings',
    configureRules: 'Customize Witty',
    disableWitty: 'Disable Witty on some websites',
    expertMode: 'Highlight less severe issues',
    expertModeExplanation:
      'When switched on, Witty highlights also less severe issues about diversity and inclusion.',
    inspirationAlternatives: 'Show inspirations to rephrase entire sentences',
    inspirationAlternativesExplanation:
      'When switched on, Witty will make suggestions to rephrase entire sentences.',
    singularThey: 'Use gender-neutral pronouns in English',
    singularTheysExplanation:
      'When switched on, Witty suggests using gender-neutral pronouns such as "their" instead of "his" or "her".',
    addSite: 'Type a website’s URL',
    invalidDomain: 'Please enter the websites in the format "google.com".',
    addDomain: 'Add Domain',
    inclusiveLanguageExplanation:
      'When this feature is active, each time you use an inclusive term correctly, witty will highlight it in green',
    styleCorrectionExplanation:
      'Turn this off to ignore stylistic not severe issues to be highlighted',
  },
};
