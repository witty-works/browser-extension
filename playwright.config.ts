import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  use: {
    browserName: 'chromium',
    headless: false,
  },
};
export default config;
