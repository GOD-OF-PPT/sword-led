import {defineConfig} from '@playwright/test';
import base from '../../playwright.v4-ui.config.ts';
const root='/Users/gordon/githome/sword-led';
export default defineConfig({...base,testDir:root+'/tests/e2e',testMatch:['v4-chapter.spec.ts','v4-navigation.spec.ts'],grep:/keyboard-only first chapter|holding Enter on a sale/,outputDir:root+'/tmp/T11-4-2-3i3/keyboard/artifacts',reporter:[['list'],['json',{outputFile:root+'/tmp/T11-4-2-3i3/keyboard/report.json'}]],webServer:{...base.webServer as object,cwd:root}});
