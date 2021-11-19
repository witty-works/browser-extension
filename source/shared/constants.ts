//Development
export const DEV_ENV = process.env.NODE_ENV === 'development';

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
  OLD_API_PLATFORMSH = 'https://api.witty.works/',
  DEV_PLATFORMSH = 'https://dev-54ta5gq-nfkxhzxe3xgbw.de-2.platformsh.site/',
  MAIN_PLATFORMSH = 'https://main-bvxea6i-qh3uq7skrqxzg.de-2.platformsh.site/',
  WITTY_LOCAL = 'http://127.0.0.1:8000/',
}

export const DefaultBaseUrlKey: keyof typeof BaseUrls = Object.keys(BaseUrls)[0] as keyof typeof BaseUrls;


//COLORS
export enum Colors {
  default = '#e9dbb2',
  ability = "#E78D5C",
  ableism = '#F06464',
  abbreviation = '#37D1E5',
  technical_frameworks = "#E78D5C",
  age = "#E78D5C",
  mental_impairment = "#E78D5C",
  mobility_impairment = "#E78D5C",
  visual_impairment = "#E78D5C",
  intellectual_impairment = "#E78D5C",
  medical_condition = "#E78D5C",
  hearing_speech_impairment = "#E78D5C",
  inclusive = '#5ACFB9',
  style = '#37D1E5',
  xenophobia = '#F06464',
  anti_semitism = '#F06464',
  anti_muslim = '#F06464',
  racism = '#F06464',
  homophobia = '#F06464',
  sexism = '#F06464',
  transphobia = '#F06464',
  openly_discriminating = '#F06464',
  passive_voice = '#37D1E5',
  gendered = '#E9DBB2',
  male_stereotype = '#E9DBB2',
  filler = '#37D1E5',
  belief = "#E78D5C",
  racist_source = "#E78D5C",
  gender_identity = "#E78D5C",
  pressure = "#E78D5C",
  formality = '#37D1E5',
  misgendering_institutions = '#37D1E5',
  americanism = '#37D1E5',
  gendered_denominations_ending = '#E9DBB2',
  corporate_rules = '#37D1E5',
  orthography = '#37D1E5',
  verbose = '#37D1E5',
  salary_vague = '#37D1E5',
  age_young = "#E78D5C",
  hidden_image = '#E9DBB2',
  leadership = '#E9DBB2',
  female_stereotype = '#E9DBB2',
  age_in_jobs = "#E78D5C",
  ethnicity = "#E78D5C",
  overload = '#F06464',
  education = "#E78D5C",
  workload = '#F06464',
  job_requirements = '#F06464',
  gen_z = '#37D1E5',
  gen_boomer = '#37D1E5',
  classism = "#E78D5C",
  sexual_orientation = "#E78D5C",
  migration = "#E78D5C",
  unconscious_bias = "#E78D5C",
  culture = "#E78D5C",
  age_old = "#E78D5C",
  binary_pronouns = '#E9DBB2',
  hollow = '#37D1E5',
  exaggerating = '#37D1E5',
  d_and_i = '#5ACFB9',
  communal = '#5ACFB9',
  agentic = '#F06464',
  titles = '#E9DBB2',
  function = '#E9DBB2',
  red = '#F06464',
  magenta = '#F277D0',
  purple = '#9489DB',
  blue  ='#55B8E9',
  cyan = '#37D1E5',
  green = '#5ACFB9',
}

export const getColor = (color:string):string => (color in Colors) ? (<any>Colors)[color]:Colors.default;

const adjustColor = (color:string, amount: number) => {
  return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const getDarkerColor = (color: string) => adjustColor(getColor(color),-80);

//Languages Supported
export enum Languages {
  en_GB = 'British English',
  en_US = 'American English',
  en_AU = 'Australian English',
  en_NZ = 'New Zeland English',
  en_SA = 'South African English',
  en_CA = 'Canadian English',
  de_DE = 'German',
  de_AT = 'Austrian German',
  de_CH = 'Swiss German',
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