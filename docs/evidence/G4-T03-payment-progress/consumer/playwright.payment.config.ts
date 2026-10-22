import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const repository=fileURLToPath(new URL('../../../../',import.meta.url)),server=fileURLToPath(new URL('../canvas-compare/snapshot-server.mjs',import.meta.url));
const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
export default defineConfig({
 testDir:'.',testMatch:'payment-ui.spec.mjs',workers:1,retries:0,fullyParallel:false,timeout:300000,
 outputDir:resolve(repository,process.env.PAYMENT_OUTPUT??'tmp/goal4-T03/runs/payment-ui-CANDIDATE/artifacts'),
 reporter:[['list'],['json',{outputFile:resolve(repository,process.env.PAYMENT_REPORT??'tmp/goal4-T03/runs/payment-ui-CANDIDATE/report.json')}]],
 use:{browserName:'chromium',baseURL:'http://127.0.0.1:4252',viewport:{width:1280,height:720},deviceScaleFactor:1,locale:'zh-CN',actionTimeout:15000,navigationTimeout:30000,trace:'off',video:'off',screenshot:'only-on-failure',launchOptions:{args:['--no-proxy-server']}},
 projects:[{name:'payment-chromium-dpr1'}],
 webServer:{command:'rtk proxy node '+quote(server)+' --root '+quote(resolve(repository,'dist'))+' --port 4252',cwd:repository,url:'http://127.0.0.1:4252/',reuseExistingServer:false,env:{NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}},
});
