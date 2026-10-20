import {defineConfig} from '@playwright/test';
import base from './browser.config.ts';
const root="/Users/gordon/githome/sword-led";
export default defineConfig({...base,projects:base.projects!.filter(p=>p.name==='native-v4'),outputDir:root+'/tmp/T11-4-2-3i2/native-retry/artifacts',reporter:[['list'],['json',{outputFile:root+'/tmp/T11-4-2-3i2/native-retry/report.json'}]]});
