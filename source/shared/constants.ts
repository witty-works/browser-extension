//Development
export const DEV_ENV = process.env.NODE_ENV === 'development';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  UNIQUE_ID = 'id',
  ENABLED = 'enabled'
}

//API endpoints
export enum BaseUrls {
  MAIN_PLATFORMSH = 'https://main-bvxea6i-qh3uq7skrqxzg.de-2.platformsh.site/',
  DEV_PLATFORMSH = 'https://dev-54ta5gq-qh3uq7skrqxzg.de-2.platformsh.site/',
  WITTY_LOCAL = 'http://127.0.0.1:8000/',
  DIVERSIFIER_LOCAL = 'https://diversifier.lndo.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
  DIVERSIFIER_PLATFORMSH = 'https://diversifier.develop-sr3snxi-oczmhzy2xpkpc.eu-4.platformsh.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
  DIVERSIFIER_WW = 'https://diversifier.witty.works/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
}

export const DefaultBaseUrlKey: keyof typeof BaseUrls = Object.keys(BaseUrls)[0] as keyof typeof BaseUrls;


//COLORS
export enum Colors {
  gendered_roles = '#e9dbb2',
  gendered_roles_hierachy = '#e9dbb2',
  gendered_roles_image = '#e9dbb2',
  gendered_denominations = '#e9dbb2',
  gendered_language = '#e9dbb2',
  agentic_language = '#F06464',
  communal_language = '#5ACFB9',
  d_and_i_words = '#5ACFB9',
  empty_words = '#37D1E5',
  boasting_words = '#37D1E5',
  orthography = '#37D1E5',
  gendered_pronouns = '#e9dbb2',
  stereotypes = '#9489DB',
  gendered_stereotypes = '#e9dbb2',
  biased_language = '#9489DB',
  ability_bias = '#9489DB',
  age_bias_old = '#9489DB',
  age_bias_young = '#9489DB',
  culture_bias = '#9489DB',
  migration_background_bias = '#9489DB',
  anti_lgtbqiplus_bias = '#9489DB',
  classism_bias = '#9489DB',
  old_language = '#37D1E5',
  new_language = '#37D1E5',
  job_requirements_bias = '#9489DB',
  requirements_overload = '#9489DB',
  education_biased_requirements = '#9489DB',
  workload_biased_requirements = '#9489DB',
  ethnicity_biased_requirements = '#9489DB',
  age_biased_requirements = '#9489DB',
  green = '#06D6A0',
}

export const getColor = (color:string):string => (<any>Colors)[color];

const adjustColor = (color:string, amount: number) => {
  return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const getDarkerColor = (color: string) => adjustColor(getColor(color),-80);