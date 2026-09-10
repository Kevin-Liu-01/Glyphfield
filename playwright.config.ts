import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  outputDir: 'reports/browser-results',
  reporter: [['list'], ['json', { outputFile: 'reports/browser-results.json' }]],
  use: {
    actionTimeout: 10_000,
    baseURL: process.env.GLYPHFIELD_BROWSER_BASE_URL ?? 'http://localhost:3014',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 1000 },
      // Opt-in local hardware measurements; the default regression environment
      // stays unchanged. Record the real renderer in the startup profile rather
      // than assuming a hardware flag actually enabled the GPU.
      launchOptions: process.env.GLYPHFIELD_BROWSER_NATIVE_GPU === '1'
        ? { args: ['--enable-gpu'] }
        : undefined,
    } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1000 } } },
  ],
});
