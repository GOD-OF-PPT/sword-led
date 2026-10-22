import {defineConfig,devices} from '@playwright/test';
const engines=[['chromium','Desktop Chrome'],['firefox','Desktop Firefox'],['webkit','Desktop Safari']] as const;
export default defineConfig({
 testDir:'./tests/release-v5',testMatch:'*.spec.ts',outputDir:'test-results/v5-release',fullyParallel:false,
 workers:1,retries:0,timeout:600000,
 reporter:[['list'],['json',{outputFile:process.env.V5_RELEASE_REPORT??'test-results/v5-release-report.json'}]],
 use:{actionTimeout:15000,navigationTimeout:30000,baseURL:'http://127.0.0.1:4246',viewport:{width:1280,height:720},trace:'off',video:'off',screenshot:'only-on-failure'},
 projects:[...engines.flatMap(([browserName,device])=>[1,2].map(deviceScaleFactor=>({
  name:`${browserName}-dpr${deviceScaleFactor}`,testIgnore:'native.spec.ts',
  use:{...devices[device],browserName,viewport:{width:1280,height:720},deviceScaleFactor,
   ...(browserName==='chromium'?{launchOptions:{args:['--no-proxy-server']}}:{})},
 }))),{name:'native-chrome',testMatch:'native.spec.ts'}],
 webServer:{command:'npm run preview -- --port 4246 --strictPort',url:'http://127.0.0.1:4246/',reuseExistingServer:false,
  env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
