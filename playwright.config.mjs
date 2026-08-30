import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev -- --port 4174',
    url: 'http://127.0.0.1:4174/?room=home',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
