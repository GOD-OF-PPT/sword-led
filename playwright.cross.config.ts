import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/*.spec.ts', testIgnore: ['**/native-input.spec.ts','**/native-ui-cache.spec.ts','**/native-v2.spec.ts'],
  outputDir: 'test-results/cross', fullyParallel: false, workers: 1, retries: 0, timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'test-results/cross-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4181', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-dpr2', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2, launchOptions: { args: ['--no-proxy-server'] } } },
    { name: 'firefox-game', use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'network.proxy.type': 0 } } } },
    { name: 'webkit-game', use: { ...devices['Desktop Safari'], deviceScaleFactor: 1 } },
    { name: 'firefox-dpr2', testMatch: ['**/acceptance.spec.ts','**/workshop.spec.ts','**/workshop-quality.spec.ts','**/v2-playable.spec.ts','**/v2-d-flow.spec.ts'], use: { ...devices['Desktop Firefox'], deviceScaleFactor: 2, launchOptions: { firefoxUserPrefs: { 'network.proxy.type': 0 } } } },
    { name: 'webkit-dpr2', testMatch: ['**/acceptance.spec.ts','**/workshop.spec.ts','**/workshop-quality.spec.ts','**/v2-playable.spec.ts','**/v2-d-flow.spec.ts'], use: { ...devices['Desktop Safari'], deviceScaleFactor: 2 } },
  ],
  webServer: { command: 'npm run preview -- --port 4181 --strictPort', url: 'http://127.0.0.1:4181', timeout: 30000,
    reuseExistingServer: false, env: { NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } },
});
