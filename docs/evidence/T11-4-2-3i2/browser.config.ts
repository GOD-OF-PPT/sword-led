import {defineConfig} from '@playwright/test';
import base from '../../playwright.v4-storage.config.ts';
const root="/Users/gordon/githome/sword-led";
export default defineConfig({...base,testDir:root+'/tests/browser',outputDir:root+'/tmp/T11-4-2-3i2/browser/artifacts',reporter:[['list'],['json',{outputFile:root+'/tmp/T11-4-2-3i2/browser/report.json'}]],webServer:{...base.webServer as object,cwd:root}});
