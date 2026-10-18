import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/*.spec.ts', outputDir: 'test-results/ui',
  fullyParallel: false, workers: 1, retries: 0, timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'test-results/ui-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4180', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium-game', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--no-proxy-server'] } } }],
  webServer: { command: 'npm run preview -- --port 4180 --strictPort', url: 'http://127.0.0.1:4180',
    timeout: 30000, reuseExistingServer: false, env: { NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } },
});
