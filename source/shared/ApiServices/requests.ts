import { IRequest } from '../types';
import { BaseUrls } from './baseUrl.constants';

let BASE_URL: string = '';

const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => {
  console.log('request setBaseURL urlKey = ', urlKey);
  BASE_URL = BaseUrls[urlKey as keyof typeof BaseUrls];
  console.log('request setBaseURL BASE_URL = ', BASE_URL);

}

export const getEntities = (text: string):IRequest => {

  console.log('requests BASE_URL = ', BASE_URL);

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