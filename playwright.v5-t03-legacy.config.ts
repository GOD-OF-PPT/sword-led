import {defineConfig,devices} from '@playwright/test';
const engines=[['chromium','Desktop Chrome'],['firefox','Desktop Firefox'],['webkit','Desktop Safari']] as const;
export default defineConfig({
 testDir:'./tests/e2e',outputDir:'test-results/v5-t03-legacy',workers:1,retries:0,timeout:180000,
 reporter:[['list'],['json',{outputFile:process.env.V5_LEGACY_REPORT??'test-results/v5-t03-legacy-report.json'}]],
 use:{baseURL:'http://127.0.0.1:4247',viewport:{width:1280,height:720},deviceScaleFactor:1,trace:'off',video:'off',screenshot:'only-on-failure'},
 projects:engines.flatMap(([browserName,device])=>[
  {name:`v2-audio-${browserName}`,testMatch:'v2-audio.spec.ts',use:{...devices[device],browserName,viewport:{width:1280,height:720},deviceScaleFactor:1}},
  {name:`v3-${browserName}`,testMatch:'v3-impact.spec.ts',grep:/left-down on the actual sword commits once/,use:{...devices[device],browserName,viewport:{width:1280,height:720},deviceScaleFactor:1}},
  {name:`v4-${browserName}`,testMatch:'v4-forge.spec.ts',grep:/v4 left-click lands|v4 250 ms presentation/,use:{...devices[device],browserName,viewport:{width:1280,height:720},deviceScaleFactor:1}},
 ]),
 webServer:{command:'npm run preview -- --port 4247 --strictPort',url:'http://127.0.0.1:4247/',reuseExistingServer:false,
  env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
