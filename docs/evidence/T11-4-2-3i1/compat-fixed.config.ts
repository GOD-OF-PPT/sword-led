import{defineConfig,devices}from'@playwright/test';
import base from '../../playwright.config.ts';
import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({...base,testDir:root+'tests/browser',outputDir:root+'tmp/T11-4-2-3i1/compat-fixed/artifacts',reporter:[['list'],['json',{outputFile:root+'tmp/T11-4-2-3i1/compat-fixed/report.json'}]],projects:[{name:'chromium-v4-compat',testMatch:'v4-compat.spec.ts',use:{...devices['Desktop Chrome']}},{name:'firefox-v4-compat',testMatch:'v4-compat.spec.ts',use:{...devices['Desktop Firefox']}},{name:'webkit-v4-compat',testMatch:'v4-compat.spec.ts',use:{...devices['Desktop Safari']}}],webServer:{...base.webServer as object,cwd:root}});
