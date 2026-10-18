import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',outputDir:'test-results/v2-release',fullyParallel:false,workers:1,retries:0,timeout:30000,
  reporter:[['list'],['json',{outputFile:'test-results/v2-release-report.json'}]],
  use:{baseURL:'http://127.0.0.1:4182',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    ...[
      {name:'v2-chromium',use:{...devices['Desktop Chrome'],deviceScaleFactor:1,launchOptions:{args:['--no-proxy-server']}}},
      {name:'v2-chromium-dpr2',use:{...devices['Desktop Chrome'],deviceScaleFactor:2,launchOptions:{args:['--no-proxy-server']}}},
      {name:'v2-firefox',use:{...devices['Desktop Firefox'],deviceScaleFactor:1,launchOptions:{firefoxUserPrefs:{'network.proxy.type':0}}}},
      {name:'v2-firefox-dpr2',use:{...devices['Desktop Firefox'],deviceScaleFactor:2,launchOptions:{firefoxUserPrefs:{'network.proxy.type':0}}}},
      {name:'v2-webkit',use:{...devices['Desktop Safari'],deviceScaleFactor:1}},
      {name:'v2-webkit-dpr2',use:{...devices['Desktop Safari'],deviceScaleFactor:2}},
    ].map(p=>({...p,testMatch:'**/v2-*.spec.ts'})),
    {name:'v2-native-chromium',testMatch:'**/native-v2.spec.ts',use:{...devices['Desktop Chrome'],launchOptions:{args:['--no-proxy-server']}}},
  ],
  webServer:{command:'npm run preview -- --port 4182 --strictPort',url:'http://127.0.0.1:4182/v2.html',reuseExistingServer:false,timeout:30000,env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
