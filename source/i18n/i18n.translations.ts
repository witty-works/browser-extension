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
    enableWitty: 'Text auf dieser Seite prüfen',
    globalSettings: 'Globale Einstellungen',
    websiteSettings: 'Aktuelle Webseite',
    caseSensitivity: 'Gross- & Kleinschreibung',
    developmentSettings: 'Entwicklungs-Einstellungen',
    spellChecking: 'Grammatik & Rechtschreibung',
    inclusiveTerms: 'Inklusive Begriffe',
    styleCorrections: 'Stilvorschläge',
    thanks: 'Thanks for your feedback! DE',
    noSupport:
      'Es tut uns leid! Witty unterstützt diese Webseite noch nicht offiziell.',
    vote: 'Stimme für diese Webseite ab',
    editor: 'Verwende das Witty Formular',
    getMoreTitle: 'Witty kann noch viel mehr!',
    getMoreText: 'Upgraden, um deine Spracheinstellungen zu teilen!',
    learnMoreButton: 'Mehr dazu',
    goToDashboard: 'Zum Witty Dashboard',
    overrideRecomendedSites: 'Witty auch auf dieser Webseite nutzen',
    backToRecomendedSites: 'Witty nur auf unterstützten Webseiten aktiv',
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
    greeting: 'Hallo',
    greetingTeam: 'Du bist eingeloggt im Team',
    greetingPlan: 'mit einem Abo von',
    settings: 'Einstellungen',
    needHelp: 'Brauchst du Hilfe?',
    getMoreTitle: 'Witty kann noch viel mehr!',
    getMoreText: 'Upgraden, um deine Spracheinstellungen zu teilen!',
    getMoreButton: 'Upgraden',
    LoginButton: 'Jetzt Anmelden',
    enableWitty: 'Witty aktivieren',
    setUpLanguages: 'Spracheinstellungen',
    configureRules: 'Witty Regeln anpassen',
    disableWitty: 'Witty auf gewissen Webseiten deaktivieren',
    expertMode: 'Inklusions-Profi werden',
    expertModeExplanation:
      'Wenn aktiviert, bietet Witty auch Vorschläge zu subtileren Fragen der Diversität und Inklusion.',
    expertModeExplanationUrl:
      'https://www.witty.works/de/blog/wie-analysiert-witty-rahmenwerk-der-inklusiven-sprache',
    inspirationAlternatives:
      'Inspirationen zur Umformulierung ganzer Sätze zeigen',
    inspirationAlternativesExplanation:
      'Wenn aktiviert, macht Witty Vorschläge zur Umformulierung ganzer Sätze.',
    singularThey: 'Im Englischen geschlechtsneutrale Pronomen vorschlagen',
    singularTheyExplanation:
      'Wenn aktiviert, schlägt Witty im Englischen geschlechtsneutrale Pronomen vor, z. B. "their" anstelle von "his" oder "her".',
    addSite: 'https://..',
    invalidDomain: 'Bitte die Webseite im Format "google.com" eingeben.',
    addDomain: 'Webseite hinzufügen',
    inclusiveLanguageExplanation:
      'Wenn aktiviert, unterstreicht Witty auch inklusive Begriffe. Bei diesen werden keine Alternativen angeboten.',
    inclusiveLanguageExplanationUrl:
      'https://www.witty.works/de/kategorien/inklusiv',
    styleCorrectionExplanation:
      'Wenn aktiviert, macht Witty Vorschläge, um Ihren Text verständlicher zu machen, oder um ihm Authentizität oder Emotionalität zu verleihen.',
    genderRoleFormat: 'Witty sollte folgende Vorschläge machen',
    genderRoleFormatFemaleAndMale:
      'Weibliche und männliche Form (z.B. "Managerin/Manager")',
    genderRoleFormatGermanEnding: 'Gewählte Gender-Endung',
    genderRoleFormatBoth:
      'Deutsche Gender-Endung und weibliche und männliche Form',
    genderRoleFormatNone: 'Nur geschlechtsneutrale Alternativen anzeigen',
    styleCorrectionExplanationUrl: 'https://www.witty.works/de/kategorien/stil',
    learnMore: 'Mehr dazu',
    primaryLanguage: 'Primäre Sprache',
    preferredLanguage: 'Ich bevorzuge',
    germanGenderEnding: 'Wähle die deutsche Gender-Endung',
    lockedInfo: 'Team Administrator:in hat diese Einstellung vorgegeben',
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
    enableWitty: 'Check text on this page',
    globalSettings: 'Global settings',
    websiteSettings: 'Current website',
    caseSensitivity: 'Check upper & lower case',
    developmentSettings: 'Development Settings',
    spellChecking: 'Check grammar & spelling',
    inclusiveTerms: 'Highlight inclusive terms',
    styleCorrections: 'Highlight style issues',
    thanks: 'Thanks for your feedback!',
    noSupport:
      'We’re sorry! Witty doesn’t yet officially support this website.',
    vote: 'Vote for this website',
    editor: 'Use Witty form instead',
    getMoreTitle: 'Get much more from Witty!',
    getMoreText:
      'Upgrade and get access to more checks and share your language settings!',
    learnMoreButton: 'Learn more',
    goToDashboard: 'Go to Witty Dashboard',
    overrideRecomendedSites: 'Use Witty also on this website',
    backToRecomendedSites: 'Use Witty only on supported websites',
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
    greeting: 'Hello',
    greetingTeam: 'You are logged in to',
    greetingPlan: 'with the subscription',
    settings: 'Settings',
    needHelp: 'Need Help?',
    getMoreTitle: 'Get much more from Witty!',
    getMoreText:
      'Upgrade and get access to more checks and share your language settings!',
    getMoreButton: 'Upgrade now',
    LoginButton: 'Login Now',
    enableWitty: 'Enable Witty',
    setUpLanguages: 'Language settings',
    configureRules: 'Customize Witty',
    disableWitty: 'Disable Witty on some websites',
    expertMode: 'Become an inclusion pro',
    expertModeExplanation:
      'When switched on, Witty highlights also more subtle issues about diversity and inclusion.',
    expertModeExplanationUrl:
      'https://www.witty.works/en/blog/how-does-witty-analyze',
    inspirationAlternatives: 'Show inspirations to rephrase entire sentences',
    inspirationAlternativesExplanation:
      'When switched on, Witty will make suggestions to rephrase entire sentences.',
    singularThey: 'Use gender-neutral pronouns in English',
    singularTheyExplanation:
      'When switched on, Witty suggests using gender-neutral pronouns such as "their" instead of "his" or "her".',
    addSite: 'https://..',
    invalidDomain: 'Please enter the websites in the format "google.com".',
    addDomain: 'Add Domain',
    inclusiveLanguageExplanation:
      'When switched on, Witty highlights inclusive terms. For these, no alternatives are offered.',
    inclusiveLanguageExplanationUrl:
      'https://www.witty.works/en/categories/inclusive',
    styleCorrectionExplanation:
      'Witty makes suggestions to make your text more understandable, or to give it authenticity or emotionality.',
    genderRoleFormat: 'Witty should suggest',
    genderRoleFormatFemaleAndMale:
      'Female and male form (e.g. "Managerin/Manager")',
    genderRoleFormatGermanEnding: 'Chosen German gender ending',
    genderRoleFormatBoth:
      'Show both German gender ending and Female and male form',
    genderRoleFormatNone: 'Only show gender neutral alternatives',
    styleCorrectionExplanationUrl:
      'https://www.witty.works/en/categories/style',
    learnMore: 'Learn more',
    primaryLanguage: 'Primary Language',
    preferredLanguage: 'I write in',
    germanGenderEnding: 'Choose the German gender ending',
    lockedInfo: 'Team administrator has locked this setting',
  },
};
