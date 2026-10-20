import {defineConfig,devices} from '@playwright/test';
const pilot=process.env.V4_DEV==='1';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'v4-*.spec.ts',outputDir:'test-results/v4-ui',workers:1,retries:0,timeout:180000,
 reporter:[['list'],['json',{outputFile:process.env.V4_REPORT??'test-results/v4-ui-report.json'}]],
 use:{baseURL:pilot?'http://127.0.0.1:4197':'http://127.0.0.1:4198',viewport:{width:1280,height:720},trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'v4-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:720},launchOptions:{args:['--no-proxy-server']}}},{name:'v4-firefox',use:{...devices['Desktop Firefox'],viewport:{width:1280,height:720}}},{name:'v4-webkit',use:{...devices['Desktop Safari'],viewport:{width:1280,height:720}}}],
 ...(pilot?{}:{webServer:{command:'npm run preview -- --port 4198 --strictPort',url:'http://127.0.0.1:4198',reuseExistingServer:false,env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}}}),
});
