//Development
export const DEV_ENV = process.env.NODE_ENV === 'development';

//Storage
export enum StorageKeys {
  API_ENDPOINT_KEY = 'apiEndpoint',
  UNIQUE_ID = 'id',
}

//API endpoints
export enum BaseUrls {
  ENTITIES_PLATFORMSH = 'https://main-bvxea6i-qh3uq7skrqxzg.de-2.platformsh.site/',
  DIVERSIFIER_LOCAL = 'https://diversifier.lndo.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
  DIVERSIFIER_PLATFORMSH = 'https://diversifier.develop-sr3snxi-oczmhzy2xpkpc.eu-4.platformsh.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
  DIVERSIFIER_WW = 'https://diversifier.witty.works/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
}

export const DefaultBaseUrlKey: keyof typeof BaseUrls = Object.keys(BaseUrls)[0] as keyof typeof BaseUrls;


//COLORS
export enum Colors {
  inclusive_words = '#8EC15C',
  non_inclusive = '#f1951c',
  male_coded_terms = '#855B67',
  male_coded_job_title = '#855B67',
  discriminating_words = '#328FAC',
  gendered_denominations = '#855B67',
  empty_words = '#8892B0',
  boasting_words = '#8892B0',
}

export const getColor = (color:string):string => (<any>Colors)[color];
