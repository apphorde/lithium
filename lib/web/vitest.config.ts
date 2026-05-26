import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          headless: true, // Set to false if you want to see the browser during tests
        },
      }),
      // https://vitest.dev/config/browser/playwright
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
    },
  },
});
