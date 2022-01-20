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


//COLORS
export enum ColorsHover {
  //inclusive
  inclusive = '#C9DF7F',
  d_and_i = '#C9DF7F',
  communal = '#C9DF7F',

  //style
  style = '#FFF7A4',
  abbreviation = '#FFF7A4',
  passive_voice = '#FFF7A4',
  filler = '#FFF7A4',
  formality = '#FFF7A4',
  misgendering_institutions = '#FFF7A4',
  americanism = '#FFF7A4',
  corporate_rules = '#FFF7A4',
  verbose = '#FFF7A4',
  salary_vague = '#FFF7A4',
  gen_z = '#FFF7A4',
  gen_boomer = '#FFF7A4',
  hollow = '#FFF7A4',
  exaggerating = '#FFF7A4',

  //Unconcious bias 
  unconscious_bias = "#F8D29F",
  male_stereotype = '#F8D29F',
  gendered_denominations_ending = '#F8D29F',
  hidden_image = '#F8D29F',
  leadership = '#F8D29F',
  female_stereotype = '#F8D29F',
  titles = '#F8D29F',
  function = '#F8D29F',

  //Gendered
  gendered = '#F8D29F',
  binary_pronouns = '#F8D29F',
  classism = "#F8D29F",
  sexual_orientation = "#F8D29F",
  migration = "#F8D29F",
  culture = "#F8D29F",
  age_old = "#F8D29F",
  technical_frameworks = "#F8D29F",
  age = "#F8D29F",
  mental_impairment = "#F8D29F",
  mobility_impairment = "#F8D29F",
  visual_impairment = "#F8D29F",
  intellectual_impairment = "#F8D29F",
  medical_condition = "#F8D29F",
  hearing_speech_impairment = "#F8D29F",
  ability = "#F8D29F",
  belief = "#F8D29F",
  racist_source = "#F8D29F",
  gender_identity = "#F8D29F",
  pressure = "#F8D29F",
  age_young = "#F8D29F",
  age_in_jobs = "#F8D29F",
  ethnicity = "#F8D29F",
  education = "#F8D29F",

  //Grammar
  orthography = '#F8BEBB',

  //Openly Discriminating, 
  openly_discriminating = '#F8BEBB',
  ableism = '#F8BEBB',
  xenophobia = '#F8BEBB',
  anti_semitism = '#F8BEBB',
  anti_muslim = '#F8BEBB',
  racism = '#F8BEBB',
  homophobia = '#F8BEBB',
  sexism = '#F8BEBB',
  transphobia = '#F8BEBB',
  overload = '#F8BEBB',
  workload = '#F8BEBB',
  job_requirements = '#F8BEBB',
  agentic = '#F8BEBB',

  default = '#F8D29F',

  //colors
  red = '#F06464',
  magenta = '#F277D0',
  purple = '#9489DB',
  blue  ='#55B8E9',
  cyan = '#37D1E5',
  green = '#5ACFB9',
}

export enum Colors {
  //inclusive
  inclusive = '#D3E4AC',
  d_and_i = '#D3E4AC',
  communal = '#D3E4AC',

  //style
  style = '#FFFFD3',
  abbreviation = '#FFFFD3',
  passive_voice = '#FFFFD3',
  filler = '#FFFFD3',
  formality = '#FFFFD3',
  misgendering_institutions = '#FFFFD3',
  americanism = '#FFFFD3',
  corporate_rules = '#FFFFD3',
  verbose = '#FFFFD3',
  salary_vague = '#FFFFD3',
  gen_z = '#FFFFD3',
  gen_boomer = '#FFFFD3',
  hollow = '#FFFFD3',
  exaggerating = '#FFFFD3',

  //Unconcious bias 
  unconscious_bias = "#F8E7CB",
  male_stereotype = '#F8E7CB',
  gendered_denominations_ending = '#F8E7CB',
  hidden_image = '#F8E7CB',
  leadership = '#F8E7CB',
  female_stereotype = '#F8E7CB',
  titles = '#F8E7CB',
  function = '#F8E7CB',

  //Gendered
  gendered = '#F8E7CB',
  binary_pronouns = '#F8E7CB',
  classism = "#F8E7CB",
  sexual_orientation = "#F8E7CB",
  migration = "#F8E7CB",
  culture = "#F8E7CB",
  age_old = "#F8E7CB",
  technical_frameworks = "#F8E7CB",
  age = "#F8E7CB",
  mental_impairment = "#F8E7CB",
  mobility_impairment = "#F8E7CB",
  visual_impairment = "#F8E7CB",
  intellectual_impairment = "#F8E7CB",
  medical_condition = "#F8E7CB",
  hearing_speech_impairment = "#F8E7CB",
  ability = "#F8E7CB",
  belief = "#F8E7CB",
  racist_source = "#F8E7CB",
  gender_identity = "#F8E7CB",
  pressure = "#F8E7CB",
  age_young = "#F8E7CB",
  age_in_jobs = "#F8E7CB",
  ethnicity = "#F8E7CB",
  education = "#F8E7CB",

  //Grammar
  orthography = '#F7D4D4',

  //Openly Discriminating, 
  openly_discriminating = '#F7D4D4',
  ableism = '#F7D4D4',
  xenophobia = '#F7D4D4',
  anti_semitism = '#F7D4D4',
  anti_muslim = '#F7D4D4',
  racism = '#F7D4D4',
  homophobia = '#F7D4D4',
  sexism = '#F7D4D4',
  transphobia = '#F7D4D4',
  overload = '#F7D4D4',
  workload = '#F7D4D4',
  job_requirements = '#F7D4D4',
  agentic = '#F7D4D4',

  default = '#F8E7CB',

  //colors
  red = '#F06464',
  magenta = '#F277D0',
  purple = '#9489DB',
  blue  ='#55B8E9',
  cyan = '#37D1E5',
  green = '#5ACFB9',
}
export const getColor = (color:string):string => (color in Colors) ? (<any>Colors)[color]:Colors.default;

export const getHoverColor = (color:string):string => (color in ColorsHover) ? (<any>ColorsHover)[color]:ColorsHover.default;

const adjustColor = (color:string, amount: number) => {
  return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const getDarkerColor = (color: string) => adjustColor(getColor(color),-80);

//German Gender Endings
export enum GermanGenderEndings {
  colon_in = ':in',
  asterisk_in = '*in',
  underscore_in = '_in',
  slash_dash_in = '/-in',
  slash_in = '/in',
  uppercase_in = 'In',
}