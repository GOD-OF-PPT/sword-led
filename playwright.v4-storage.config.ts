import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',outputDir:'test-results/v4-storage',fullyParallel:false,workers:1,retries:0,timeout:60000,
 reporter:[['list'],['json',{outputFile:'test-results/v4-storage-report.json'}]],
 use:{baseURL:'http://127.0.0.1:4178',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'chromium-v4',testMatch:['**/v4-storage.spec.ts','**/v4-compat.spec.ts'],use:{...devices['Desktop Chrome'],launchOptions:{args:['--no-proxy-server']}}},
  {name:'firefox-v4',testMatch:['**/v4-storage.spec.ts','**/v4-compat.spec.ts'],use:{...devices['Desktop Firefox']}},
  {name:'webkit-v4',testMatch:['**/v4-storage.spec.ts','**/v4-compat.spec.ts'],use:{...devices['Desktop Safari']}},
  {name:'native-v4',testMatch:'**/v4-native-cache.spec.ts'},
  {name:'legacy-storage',testMatch:['**/persistence.spec.ts','**/native-cache.spec.ts'],use:{...devices['Desktop Chrome'],launchOptions:{args:['--no-proxy-server']}}},
 ],
 webServer:{command:'node tests/browser/server.mjs',url:'http://127.0.0.1:4178/tests/browser/fixture.html',timeout:30000,reuseExistingServer:false,env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
