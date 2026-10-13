import { defineConfig, devices } from '@playwright/test';

// BASE_URL lets the same suite run against local, staging or production.
// When it's not set, Playwright starts the demo app locally.
const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
const isLocal = !process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  // Tests share one in-memory app and reset it before each test, so run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure', // attach traces to bug reports
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'chromium', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testDir: './tests/e2e', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testDir: './tests/e2e', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', testDir: './tests/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', testDir: './tests/e2e', use: { ...devices['iPhone 14'] } },
  ],
  webServer: isLocal
    ? {
        command: 'node app/server.js',
        url: 'http://localhost:4321/health',
        env: { TEST_MODE: '1', PORT: '4321' },
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
