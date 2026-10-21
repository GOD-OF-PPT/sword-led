import {defineConfig,devices} from '@playwright/test';

const engines=[['chromium','Desktop Chrome'],['firefox','Desktop Firefox'],['webkit','Desktop Safari']] as const;
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'v5-*.spec.ts',outputDir:'test-results/v5-ui',fullyParallel:false,
 workers:1,retries:0,timeout:420000,
 reporter:[['list'],['json',{outputFile:process.env.V5_REPORT??'test-results/v5-ui-report.json'}]],
 use:{actionTimeout:15000,navigationTimeout:30000,baseURL:'http://127.0.0.1:4245',viewport:{width:1280,height:720},trace:'off',screenshot:'only-on-failure'},
 projects:engines.flatMap(([browserName,device])=>[1,2].map(deviceScaleFactor=>({
  name:`${browserName}-dpr${deviceScaleFactor}`,
  use:{...devices[device],browserName,viewport:{width:1280,height:720},deviceScaleFactor,
   ...(browserName==='chromium'?{launchOptions:{args:['--no-proxy-server']}}:{})},
 }))),
 webServer:{command:'npm run preview -- --port 4245 --strictPort',url:'http://127.0.0.1:4245/',reuseExistingServer:false,
  env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
