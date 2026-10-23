import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const required=name=>{assert(process.env[name],`${name} required`);return process.env[name];};
const snapshot=path.resolve(required('V6_UI_SNAPSHOT')),url=new URL(required('V6_UI_URL')),output=path.resolve(required('V6_UI_OUTPUT'));
assert(!snapshot.split(path.sep).includes('dist'));assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/v6.html');await mkdir(output);
const sha=value=>createHash('sha256').update(value).digest('hex'),sdk=await readFile(path.join(snapshot,'sword-led-v6.js'));
const api=await import(pathToFileURL(path.join(snapshot,'sword-led-v6.js')).href);
assert.equal(sha(Buffer.from(await(await fetch(new URL('/sword-led-v6.js',url))).arrayBuffer())),sha(sdk));
const sourcePath=required('V6_FAILED_RESULT'),source=await readFile(sourcePath),failed=JSON.parse(source).threeBlades.final;
assert.equal(failed.phase,'failed');assert.equal(failed.revision,21);assert(api.validateRun(failed).ok);
const map=new Map(),repository=api.createV6SaveRepository(()=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}));repository.load();assert(repository.write(failed).ok);
const report={status:'running',scope:'Restore the actually observed failed 21-command run, then cancel and confirm an explicit restart; not another fresh full campaign.',
 identity:{snapshot,url:url.href,sdkSha256:sha(sdk),sourcePath,sourceSha256:sha(source),scriptSha256:sha(await readFile(new URL(import.meta.url)))},errors:[],failure:null};
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
report.identity.browserVersion=browser.version();page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
async function slots(){return page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),[api.V6_SAVE_KEY,api.V6_BACKUP_KEY]);}
try{
 await page.goto(new URL('/assets/d/v09/practice-target-v1.webp',url).href);await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:api.V6_SAVE_KEY,raw:map.get(api.V6_SAVE_KEY)});
 await page.goto(url.href);await expect(page.locator('#x6-continue')).toBeEnabled();await page.locator('#x6-continue').click();await expect(page.locator('.x6-game')).toHaveAttribute('data-screen','recap');
 const before=await slots();assert.deepEqual(api.decodeV6Save(before[0]).state,failed);
 await page.locator('#x6-again').click();await expect(page.locator('#x6-dialog-title')).toHaveText('另起一炉？');await page.getByRole('button',{name:'再想想',exact:true}).click();
 assert.deepEqual(await slots(),before);await expect(page.locator('.x6-game')).toHaveAttribute('data-screen','recap');await page.screenshot({path:path.join(output,'restart-canceled-keeps-failed-story.png')});
 await page.locator('#x6-again').click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.locator('.x6-game')).toHaveAttribute('data-screen','play');
 const after=await slots(),decoded=api.decodeV6Save(after[0]);assert.equal(decoded.status,'valid');const fresh=decoded.state,created=api.createRun({runId:fresh.runId,seed:fresh.seed});assert(created.ok);assert.deepEqual(fresh,created.state);assert.notEqual(fresh.runId,failed.runId);
 assert.equal(fresh.revision,0);assert.equal(fresh.coins,0);assert.equal(fresh.tool,null);assert.equal(fresh.charges.main,1);assert.equal(fresh.blades.length,3);assert.equal(after[1],before[0]);assert.equal(report.errors.length,0);
 report.cancelPreservedBothRawSlots=true;report.confirmCreatedNewRun=true;report.previousRunId=failed.runId;report.fresh=fresh;report.priorRunKeptAsBackup=true;report.status='passed';
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};throw error;}
finally{report.finishedAt=new Date().toISOString();await writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2));await context.close();await browser.close();}
console.log(JSON.stringify({status:report.status,cancelPreservedBothRawSlots:report.cancelPreservedBothRawSlots,confirmCreatedNewRun:report.confirmCreatedNewRun,priorRunKeptAsBackup:report.priorRunKeptAsBackup}));
