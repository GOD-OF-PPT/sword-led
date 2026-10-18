import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'test-results/storage',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'test-results/storage-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4178',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-storage', use: {
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--no-proxy-server'] },
  } }],
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: 'http://127.0.0.1:4178/tests/browser/fixture.html',
    timeout: 30000,
    reuseExistingServer: false,
    env: { NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' },
  },
});
