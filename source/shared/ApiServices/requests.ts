import { IRequest } from '../types';

export const BASE_URL = 'https://main-bvxea6i-qh3uq7skrqxzg.de-2.platformsh.site/';
// export const BASE_URL = 'https://diversifier.lndo.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/';
// export const BASE_URL = 'https://diversifier.develop-sr3snxi-oczmhzy2xpkpc.eu-4.platformsh.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/';
// export const BASE_URL = 'https://diversifier.witty.works/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/';


const createUrl = (base: string, path: string): string => `${base}${path}`;

export const getEntities = (text: string):IRequest => {

  // console.log('getEntities text = ', text);

  return {
    url: createUrl(BASE_URL, 'entities'),
    config:{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({text: text, lang: 'auto'})
    }
  }
};