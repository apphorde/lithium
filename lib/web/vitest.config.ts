import { defineConfig } from 'vitest/config';
// import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    environment: 'jsdom',
    css: false,
    passWithNoTests: false,
    reporters: process.env.DEBUG ? ['verbose', 'hanging-process'] : ['default'],
  },
});
