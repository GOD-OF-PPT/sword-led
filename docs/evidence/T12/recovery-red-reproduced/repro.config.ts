import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:process.cwd()+'/tests/e2e',testMatch:'**/v2-resilience.spec.ts',outputDir:process.cwd()+'/tmp/T12-red-repro-outputs',workers:1,retries:0,timeout:30000,
reporter:[['list'],['json',{outputFile:process.cwd()+'/tmp/T12-red-repro-report.json'}]],use:{baseURL:'http://127.0.0.1:4182',trace:'retain-on-failure',screenshot:'only-on-failure'},
projects:[{name:'original-chromium-red-reproduction',use:{...devices['Desktop Chrome'],launchOptions:{args:['--no-proxy-server']}}}],
webServer:{cwd:process.cwd(),command:'npx vite preview --host 127.0.0.1 --port 4182 --strictPort --outDir tmp/previews/T11-4',url:'http://127.0.0.1:4182/v2.html',reuseExistingServer:false,env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}}});
