import { browser } from 'webextension-polyfill-ts';
import { DEV_ENV, Colors } from '../constants';

export enum logTypes {
  INFO = 'info',
  ERROR = 'error',
}

export const useLog = (
  componentName: string
): ((message: string, type?: string, data?: any) => void) => {
  const wittyVersion = browser.runtime.getManifest().version;

  const log = (message: string, type?: string, data?: any) => {
    if (DEV_ENV) {
      console.log(
        `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
        `color: ${Colors.blue}`,
        `color: ${Colors.green}`,
        `color: ${type && type === logTypes.ERROR ? '#f00' : '#000'}`,
        data ? data : ''
      );
    }
  };

  return log;
};
