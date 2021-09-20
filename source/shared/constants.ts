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
  agentic_language = '#d2bcb2',
  communal_language = '#b2d2ca',
  d_and_i_words = '#b2d2ca',
  empty_words = '#c1ddf7',
  boasting_words = '#c1ddf7',
  gendered_pronouns = '#e9dbb2',
  stereotypes = '#ebc8b2',
  gendered_stereotypes = '#e9dbb2',
  biased_language = '#ebc8b2',
  ability_bias = '#ebc8b2',
  age_bias_old = '#ebc8b2',
  age_bias_young = '#ebc8b2',
  culture_bias = '#ebc8b2',
  migration_background_bias = '#ebc8b2',
  anti_lgtbqiplus_bias = '#ebc8b2',
  classism_bias = '#ebc8b2',
  old_language = '#c1ddf7',
  new_language = '#c1ddf7',
  job_requirements_bias = '#ebc8b2',
  requirements_overload = '#ebc8b2',
  education_biased_requirements = '#ebc8b2',
  workload_biased_requirements = '#ebc8b2',
  ethnicity_biased_requirements = '#ebc8b2',
  age_biased_requirements = '#ebc8b2',
  green = '#06D6A0',
}

export const getColor = (color:string):string => (<any>Colors)[color];

const adjustColor = (color:string, amount: number) => {
  return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const getDarkerColor = (color: string) => adjustColor(getColor(color),-100);