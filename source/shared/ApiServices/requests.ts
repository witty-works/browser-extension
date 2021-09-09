import { IRequest } from '../types';
import { BaseUrls } from '../constants';

let BASE_URL: string = '';

console.log('process.env.NODE_ENV = ', process.env.NODE_ENV);


const createUrl = (base: string, path: string): string => `${base}${path}`;

export const setBaseURL = (urlKey: string) => BASE_URL = BaseUrls[urlKey as keyof typeof BaseUrls];

export const getAnalyzedTextResults = (text: string):IRequest => {
  return {
    url: createUrl(BASE_URL, 'check'),
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