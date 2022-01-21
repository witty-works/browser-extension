import { browser } from 'webextension-polyfill-ts';

export const wittyVersion = browser.runtime.getManifest().version;

//Development
export const DEV_ENV = process.env.NODE_ENV === 'development';

export const POSTHOG_API_KEY = DEV_ENV ? 'phc_o3cjCKKkO7rn3CTBUJNmehFoa6vPc3zYavfnGj7WyqK' : 'phc_tmJbApENFHLXMjwG1hHMYO4Md8qR4XAGRforELIiDwp';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  APP_ID = 'id',
  APP_ENABLED = 'enabled',
  PRIMARY_LANGUAGE = 'primaryLanguage',
  PREFERRED_LANGUAGES = 'preferredLanguages',
  GERMAN_GENDER_ENDING = 'germanGenderEnding'
}

//API endpoints
export enum BaseUrls {
  API_PLATFORMSH = 'https://default.api.witty.works/',
  DEV_PLATFORMSH = 'https://dev-54ta5gq-nfkxhzxe3xgbw.de-2.platformsh.site/',
  MAIN_PLATFORMSH = 'https://main-bvxea6i-qh3uq7skrqxzg.de-2.platformsh.site/',
  WITTY_LOCAL = 'http://127.0.0.1:8000/',
}

export const DefaultBaseUrlKey: keyof typeof BaseUrls = Object.keys(BaseUrls)[0] as keyof typeof BaseUrls;

export enum Colors {
  red = '#F06464',
  magenta = '#F277D0',
  purple = '#9489DB',
  blue  ='#55B8E9',
  cyan = '#37D1E5',
  green = '#5ACFB9'
}
interface IHighlightColors {
  default: string;
  highlight: string;
  hover: string;
}

const inclusive: IHighlightColors = {
  default: '#BCD485',
  highlight: '#D3E4AC',
  hover: '#C9DF7F',
}
const style: IHighlightColors = {
  default: '#F6EC6B',
  highlight: '#FFFFD3',
  hover: '#FFF7A4',
}
const unconsciousBiasAndGendered: IHighlightColors = {
  default: '#EB9F46',
  highlight: '#F8E7CB',
  hover: '#F8D29F',
}
const openlyDiscriminatingAndGrammar: IHighlightColors = {
  default: '#E6635A',
  highlight: '#F7D4D4',
  hover: '#F8BEBB',
}

export enum Category {
  inclusive = 'inclusive',
  d_and_i = 'd_and_i',
  communal = 'communal',

  style = 'style',
  abbreviation = 'abbreviation',
  passive_voice = 'passive_voice',
  filler = 'filler',
  formality = 'formality',
  misgendering_institutions = 'misgendering_institutions',
  americanism = 'americanism',
  corporate_rules = 'corporate_rules',
  verbose = 'verbose',
  salary_vague = 'salary_vague',
  gen_z = 'gen_z',
  gen_boomer = 'gen_boomer',
  hollow = 'hollow',
  exaggerating = 'exaggerating',

  unconscious_bias = 'unconscious_bias',
  male_stereotype = 'male_stereotype',
  gendered_denominations_ending = 'gendered_denominations_ending',
  hidden_image = 'hidden_image',
  leadership = 'leadership',
  female_stereotype ='female_stereotype',
  titles = 'titles',
  function = 'function',
  gendered = 'gendered',
  binary_pronouns = 'binary_pronouns',
  classism = 'classism',
  sexual_orientation = 'sexual_orientation',
  migration = 'migration',
  culture = 'culture',
  age_old = 'age_old',
  technical_frameworks = 'technical_frameworks',
  age = 'age',
  mental_impairment = 'mental_impairment',
  mobility_impairment = 'mobility_impairment',
  visual_impairment = 'visual_impairment',
  intellectual_impairment = 'intellectual_impairment',
  medical_condition = 'medical_condition',
  hearing_speech_impairment = 'hearing_speech_impairment',
  ability = 'ability',
  belief = 'belief',
  racist_source = 'racist_source',
  gender_identity = 'gender_identity',
  pressure = 'pressure',
  age_young = 'age_young',
  age_in_jobs = 'age_in_jobs',
  ethnicity = 'ethnicity',
  education ='education',

  orthography = 'orthography',
  openly_discriminating ='openly_discriminating',
  ableism = 'ableism',
  xenophobia = 'xenophobia',
  anti_semitism = 'anti_semitism',
  anti_muslim = 'anti_muslim',
  racism = 'racism',
  homophobia = 'homophobia',
  sexism = 'sexism',
  transphobia = 'transphobia',
  overload = 'overload',
  workload = 'workload',
  job_requirements = 'job_requirements',
  agentic = 'agentic',
}

const categoryColors: Record<Category, IHighlightColors> = {
  [Category.inclusive]: inclusive,
  [Category.d_and_i]: inclusive,
  [Category.communal]: inclusive,

  [Category.style]: style,
  [Category.abbreviation]: style,
  [Category.passive_voice]: style,
  [Category.filler]: style,
  [Category.formality]: style,
  [Category.misgendering_institutions]: style,
  [Category.americanism]: style,
  [Category.corporate_rules]: style,
  [Category.verbose]: style,
  [Category.salary_vague]: style,
  [Category.gen_z]: style,
  [Category.gen_boomer]: style,
  [Category.hollow]: style,
  [Category.exaggerating]: style,

  [Category.unconscious_bias]: unconsciousBiasAndGendered,
  [Category.male_stereotype]: unconsciousBiasAndGendered,
  [Category.gendered_denominations_ending]: unconsciousBiasAndGendered,
  [Category.hidden_image]: unconsciousBiasAndGendered,
  [Category.leadership]: unconsciousBiasAndGendered,
  [Category.female_stereotype]: unconsciousBiasAndGendered,
  [Category.titles]: unconsciousBiasAndGendered,
  [Category.function]: unconsciousBiasAndGendered,
  [Category.gendered]: unconsciousBiasAndGendered,
  [Category.binary_pronouns]: unconsciousBiasAndGendered,
  [Category.classism]: unconsciousBiasAndGendered,
  [Category.sexual_orientation]: unconsciousBiasAndGendered,
  [Category.migration]: unconsciousBiasAndGendered,
  [Category.culture]: unconsciousBiasAndGendered,
  [Category.age_old]: unconsciousBiasAndGendered,
  [Category.technical_frameworks]: unconsciousBiasAndGendered,
  [Category.age]: unconsciousBiasAndGendered,
  [Category.mental_impairment]: unconsciousBiasAndGendered,
  [Category.mobility_impairment]: unconsciousBiasAndGendered,
  [Category.visual_impairment]: unconsciousBiasAndGendered,
  [Category.intellectual_impairment]: unconsciousBiasAndGendered,
  [Category.medical_condition]: unconsciousBiasAndGendered,
  [Category.hearing_speech_impairment]: unconsciousBiasAndGendered,
  [Category.ability]: unconsciousBiasAndGendered,
  [Category.belief]: unconsciousBiasAndGendered,
  [Category.racist_source]: unconsciousBiasAndGendered,
  [Category.gender_identity]: unconsciousBiasAndGendered,
  [Category.pressure]: unconsciousBiasAndGendered,
  [Category.age_young]: unconsciousBiasAndGendered,
  [Category.age_in_jobs]: unconsciousBiasAndGendered,
  [Category.ethnicity]: unconsciousBiasAndGendered,
  [Category.education]: unconsciousBiasAndGendered,

  [Category.orthography]: openlyDiscriminatingAndGrammar,
  [Category.openly_discriminating]: openlyDiscriminatingAndGrammar,
  [Category.ableism]: openlyDiscriminatingAndGrammar,
  [Category.xenophobia]: openlyDiscriminatingAndGrammar,
  [Category.anti_semitism]: openlyDiscriminatingAndGrammar,
  [Category.anti_muslim]: openlyDiscriminatingAndGrammar,
  [Category.racism]: openlyDiscriminatingAndGrammar,
  [Category.homophobia]: openlyDiscriminatingAndGrammar,
  [Category.sexism]: openlyDiscriminatingAndGrammar,
  [Category.transphobia]: openlyDiscriminatingAndGrammar,
  [Category.overload]: openlyDiscriminatingAndGrammar,
  [Category.workload]: openlyDiscriminatingAndGrammar,
  [Category.job_requirements]: openlyDiscriminatingAndGrammar,
  [Category.agentic]: openlyDiscriminatingAndGrammar
}

export const getColor = (category: string): IHighlightColors => {
  return category in Category ? categoryColors[category as Category] : unconsciousBiasAndGendered;
}

//German Gender Endings
export enum GermanGenderEndings {
  colon_in = ':in',
  asterisk_in = '*in',
  underscore_in = '_in',
  slash_dash_in = '/-in',
  slash_in = '/in',
  uppercase_in = 'In',
}