import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for UiPath Playwright Migrator
 * Generic migration engine for converting UiPath workflows to Playwright tests.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.TARGET_URL || process.env.APP_URL || 'http://127.0.0.1:3000',
    actionTimeout: 10000,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
