// @ts-check
'use strict';

const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E configuration for SmartHome Pro.
 *
 * Dashboard runs on port 3001, backend API on port 3000.
 * Tests assume both services are either already running or started
 * via the webServer config below.
 *
 * To run against live services: npx playwright test
 * To run with auto-started servers: set USE_SERVER=true env var
 */
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.DASHBOARD_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
