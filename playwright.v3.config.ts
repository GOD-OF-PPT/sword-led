import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'v3-*.spec.ts',outputDir:'test-results/v3',workers:1,retries:0,timeout:60000,
 reporter:[['list'],['json',{outputFile:'test-results/v3-report.json'}]],
 use:{baseURL:'http://127.0.0.1:4186',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'v3-chromium',use:{...devices['Desktop Chrome']}},{name:'v3-firefox',use:{...devices['Desktop Firefox']}},{name:'v3-webkit',use:{...devices['Desktop Safari']}}],
 webServer:{command:'npm run preview -- --port 4186 --strictPort',url:'http://127.0.0.1:4186',reuseExistingServer:false,env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
