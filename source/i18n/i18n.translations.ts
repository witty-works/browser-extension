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
    enableWitty: 'Witty aktivieren',
    globalSettings: 'Schnell-Einstellungen',
    websiteSettings: 'Einstellungen für {{domain}}',
    caseSensitivity: 'Gross- & Kleinschreibung',
    developmentSettings: 'Entwicklungs-Einstellungen',
    spellChecking: 'Grammatik & Rechtschreibung',
    inclusiveTerms: 'Inklusive Begriffe',
    styleCorrections: 'Stilvorschläge',
    thanks: 'Danke für deinen Beitrag!',
    noSupport:
      'Es tut uns leid! Witty unterstützt diese Webseite noch nicht offiziell.',
    vote: 'Stimme für diese Webseite ab',
    editor: 'Nutze alternativ Witty Text-Tool',
    getMoreTitle: 'Witty für dein Team',
    getMoreText: 'Entdecke Witty Teams, um als Team konsistent zu schreiben!',
    learnMoreButton: 'Kostenlos testen',
    goToDashboard: 'Zum Witty Dashboard',
    overrideRecomendedSites: 'Witty hier dennoch aktivieren',
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
    getMoreTitle: 'Witty für dein Team',
    getMoreText:
      'Registriere dich auf Witty Dashboard um Spracheinstellungen für dein Team zu definieren!',
    getMoreButton: 'Kostenlos testen',
    LoginButton: 'Registrieren / Anmelden',
    setUpLanguages: 'Spracheinstellungen',
    configureRules: 'Witty Regeln für mich anpassen',
    disableWitty: 'Witty auf gewissen Webseiten deaktivieren',
    expertMode: 'Inklusions-Profi werden',
    expertModeExplanation:
      'Wenn eingeschaltet, bietet Witty Vorschläge zu subtileren Fragen der Diversität und Inklusion. Witty würde z.Bsp. Hilfe bei Abkürzungen wie ROI oder SaaS bieten.',
    inspirationAlternatives:
      'Inspirationen zur Umformulierung ganzer Sätze vorschlagen',
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
    genderRoleFormat: 'Wie soll Witty mit dem generischen Maskulinum umgehen?',
    genderRoleFormatExplanation:
      'Wähle aus, ob Witty die gewählte Gender-Ending-Form (z.B. "Mitarbeiter*in"), nur die weibliche und männliche Form (z.B. "Mitarbeiterin oder Mitarbeiter"), beides oder nur genderneutrale Alternativen vorschlagen soll.',
    genderRoleFormatFemaleAndMale: 'Weibliche und männliche Form vorschlagen',
    genderRoleFormatGermanEnding: 'Gewählte Gender-Endung vorschlagen',
    genderRoleFormatBoth:
      'Die gewählte Gender-Endung und die weibliche und männliche Form vorschlagen',
    genderRoleFormatNone: 'Nur geschlechtsneutrale Alternativen vorschlagen',
    styleCorrectionExplanationUrl: 'https://www.witty.works/de/kategorien/stil',
    learnMore: 'Mehr dazu',
    preferredLanguage: 'Ich bevorzuge',
    germanGenderEnding: 'Wähle die deutsche Gender-Endung',
    lockedInfo: 'Team-Vorgabe',
    resetTeamsSettings: 'Auf Standardwerte zurücksetzen',
    createATeam: 'Erstelle ein Team',
    wittyTeamsOnly: 'Nur Witty Teams',
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
    enableWitty: 'Enable Witty',
    globalSettings: 'Quick settings',
    websiteSettings: 'Settings for {{domain}}',
    caseSensitivity: 'Check upper & lower case',
    developmentSettings: 'Development Settings',
    spellChecking: 'Check grammar & spelling',
    inclusiveTerms: 'Highlight inclusive terms',
    styleCorrections: 'Highlight style issues',
    thanks: 'Thanks for your feedback!',
    noSupport:
      'We’re sorry! Witty doesn’t yet officially support this website.',
    vote: 'Vote for this website',
    editor: 'Use Witty text tool instead',
    getMoreTitle: 'Witty for your team',
    getMoreText: 'Explore Witty Teams and start writing consistently as a team!',
    learnMoreButton: 'Try for free',
    goToDashboard: 'Go to Witty Dashboard',
    overrideRecomendedSites: 'Try Witty here anyway',
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
    getMoreTitle: 'Witty for your team',
    getMoreText:
      'Explore Witty Teams and start writing consistently as a team!',
    getMoreButton: 'Try for free',
    LoginButton: 'Register / Login',
    setUpLanguages: 'Language settings',
    configureRules: 'Customize Witty for me',
    disableWitty: 'Disable Witty on some websites',
    expertMode: 'Become an inclusion pro',
    expertModeExplanation:
      'When switched on, Witty highlights more subtle aspects of diversity and inclusion. For example, Witty would highlight acronyms such as ROI or SaaS.',
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
    genderRoleFormat: 'How should Witty handle the generic masculine?',
    genderRoleFormatExplanation:
      'Choose if Witty should suggest the chosen gender ending (e.g. "Mitarbeiter*in"), the female and male form (e.g. "Mitarbeiterin oder Mitarbeiter"), both or only gender-neutral alternatives ("Mitarbeitende").',
    genderRoleFormatFemaleAndMale: 'Suggest the female and male form',
    genderRoleFormatGermanEnding: 'Suggest the chosen gender ending',
    genderRoleFormatBoth:
      'Suggest both the chosen gender ending and the female and male form',
    genderRoleFormatNone: 'Suggest only gender-neutral alternatives',
    styleCorrectionExplanationUrl:
      'https://www.witty.works/en/categories/style',
    learnMore: 'Learn more',
    preferredLanguage: 'I write in',
    germanGenderEnding: 'Choose the gender ending',
    lockedInfo: 'Team presetting',
    resetTeamsSettings: 'Reset to defaults',
    createATeam: 'Create a new team',
    wittyTeamsOnly: 'Witty Teams Only',
  },
};
