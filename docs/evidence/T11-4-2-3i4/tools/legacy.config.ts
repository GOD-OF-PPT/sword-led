import {defineConfig} from '@playwright/test';
import base from '../../playwright.v3.config.ts';
const root="/Users/gordon/githome/sword-led";
export default defineConfig({...base,testDir:root+'/tests/e2e',testMatch:['v3-campaign.spec.ts','v3-playable.spec.ts'],grep:/existing three-round save|three misses really fail|same-origin v2 writer/,outputDir:root+'/tmp/T11-4-2-3i4/legacy/artifacts',reporter:[['list'],['json',{outputFile:root+'/tmp/T11-4-2-3i4/legacy/report.json'}]],webServer:{...base.webServer as object,cwd:root}});
