import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';

const required=name=>{assert(process.env[name],`${name} is required`);return process.env[name];};
const snapshot=path.resolve(required('V6_UI_SNAPSHOT')),url=new URL(required('V6_UI_URL'));
assert(!snapshot.split(path.sep).includes('dist'));assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/v6.html');
const output=path.resolve(required('V6_UI_OUTPUT'));await mkdir(output); // Refuse overwriting a prior run.
const sha=value=>createHash('sha256').update(value).digest('hex');
const sdk=await readFile(path.join(snapshot,'sword-led-v6.js'));
const api=await import(pathToFileURL(path.join(snapshot,'sword-led-v6.js')).href);
assert.equal(sha(Buffer.from(await (await fetch(new URL('/sword-led-v6.js',url))).arrayBuffer())),sha(sdk));
const backupOnly=process.env.V6_BOUNDARY_ONLY==='backup';
const report={status:'running',scope:backupOnly?'Backup recovery boundary only; the already passed 21-action fresh failure is not repeated.':'One fresh three-weak-blades failure and one explicitly prepared backup-source recovery boundary. Not a browser matrix or player fun acceptance.',
 identity:{snapshot,url:url.href,sdkSha256:sha(sdk),scriptSha256:sha(await readFile(new URL(import.meta.url)))},failure:null,commands:[],errors:[]};
const save=()=>writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2));await save();
const browser=await chromium.launch();report.identity.browserVersion=browser.version();
const contexts=[];
async function context(){const c=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'});contexts.push(c);return c;}
function watch(page){page.on('pageerror',e=>report.errors.push(String(e)));page.on('requestfailed',r=>report.errors.push(`${r.url()} ${r.failure()?.errorText}`));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});}
async function raw(page){return page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),[api.V6_SAVE_KEY,api.V6_BACKUP_KEY]);}
async function state(page){const [source]=await raw(page),decoded=api.decodeV6Save(source);assert.equal(decoded.status,'valid');assert(api.validateRun(decoded.state).ok);return decoded.state;}
async function idle(page){await expect(page.locator('.x6-game')).toHaveAttribute('data-busy','false');await expect(page.locator('[data-x6-transient]')).toHaveCount(0);}
try{
 if(!backupOnly){
 const c=await context(),page=await c.newPage();watch(page);await page.goto(url.href);
 await page.locator('.x6-seed summary').click();await page.locator('#x6-seed').fill('v6-contract');await expect(page.locator('#x6-start')).toBeEnabled();await page.locator('#x6-start').click();
 await expect(page.locator('.x6-game')).toHaveAttribute('data-screen','play');await expect(page.locator('#x6-blade')).toHaveAttribute('data-art','ready');
 let expected=await state(page);assert.equal(expected.revision,0);assert.equal(expected.seed,'v6-contract');
 for(const id of ['main-1','main-2','main-3']){
  const actions=[[{type:'chooseSchool',pieceId:id,school:'steady'},'#x6-school-steady'],
   [{type:'forge',pieceId:id,useTechnique:false},'#x6-forge'],[{type:'forge',pieceId:id,useTechnique:false},'#x6-forge'],
   [{type:'seal',pieceId:id},'#x6-seal'],...Array.from({length:3},()=>[{type:'strike',targetId:'main-guard'},'#x6-primary'])];
  for(const[action,selector]of actions){const result=api.applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action});assert(result.ok,result.error);
   await page.locator(selector).click();await idle(page);const actual=await state(page);assert.deepEqual(actual,result.state);expected=actual;
   report.commands.push({revision:actual.revision,action,stateSha256:sha(JSON.stringify(actual)),eventsFromFormalSdk:result.events});}
 }
 assert.equal(expected.phase,'failed');assert.equal(expected.coins,0);assert.equal(expected.tool,null);assert.equal(expected.revision,21);
 await expect(page.locator('#x6-recap-title')).toHaveText('这次还没开路');await expect(page.locator('#x6-again')).toBeEnabled();
 await page.screenshot({path:path.join(output,'three-used-blades-failure.png')});report.threeBlades={final:expected,actualCommands:21,realFreshRun:true,passed:true};await c.close();
 }

 // Explicit restore/fault fixture from already observed real Accepted states.
 // This does not claim another fresh campaign or fabricate economic fields.
 const sourcePath=required('V6_TOOL_RAW_RESULT'),source=await readFile(sourcePath),tool=JSON.parse(source).routes.find(r=>r.school==='steady');
 const before=tool.commands.at(-1).before,final=tool.final;
 assert.equal(before.revision,18);assert.equal(final.revision,19);assert(api.validateRun(before).ok);assert(api.validateRun(final).ok);
 const encode=run=>{const map=new Map(),repo=api.createV6SaveRepository(()=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}));repo.load();assert(repo.write(run).ok);return map.get(api.V6_SAVE_KEY);};
 const first=encode(before),replacement=encode(final),future=JSON.stringify({...JSON.parse(first),schemaVersion:7,rulesVersion:'forge-v7'});
 const recoveryContext=await context(),recovery=await recoveryContext.newPage();watch(recovery);
 const inertUrl=new URL('/assets/d/v09/practice-target-v1.webp',url).href;
 await recovery.goto(inertUrl);await recovery.evaluate(({main,backup,first,future})=>{localStorage.setItem(main,future);localStorage.setItem(backup,first);},{main:api.V6_SAVE_KEY,backup:api.V6_BACKUP_KEY,first,future});
 await recovery.goto(url.href);await expect(recovery.locator('#x6-start')).toBeEnabled();await recovery.locator('#x6-save').click();
 await recovery.getByRole('button',{name:'恢复眼前这份备份',exact:true}).click();await expect(recovery.locator('#x6-dialog-title')).toHaveText('恢复这份备份？');
 const other=await recoveryContext.newPage();await other.goto(inertUrl);await other.evaluate(({key,value})=>localStorage.setItem(key,value),{key:api.V6_BACKUP_KEY,value:replacement});
 await recovery.getByRole('button',{name:'确认',exact:true}).click();await expect(recovery.locator('#x6-dialog-body')).toContainText('备份已变化，请重新核对眼前来源。');
 assert.deepEqual(await raw(recovery),[future,replacement]);await recovery.screenshot({path:path.join(output,'changed-backup-needs-reconfirmation.png')});
 await recovery.getByRole('button',{name:'恢复眼前这份备份',exact:true}).click();await recovery.getByRole('button',{name:'确认',exact:true}).click();await idle(recovery);
 await expect(recovery.locator('.x6-game')).toHaveAttribute('data-screen','recap');assert.deepEqual(await state(recovery),final);
 await expect(recovery.locator('#x6-save-warning')).toBeHidden();assert.equal((await raw(recovery))[1],replacement);
 await recovery.screenshot({path:path.join(output,'reconfirmed-actual-backup-restored.png')});
 report.backup={fixture:'One future-schema main and two lawful original Accepted tool03 states; prepared only in an isolated browser context.',sourcePath,sourceSha256:sha(source),
  firstStateRevision:18,replacementRevision:19,changedSourceRejectedWithoutWriting:true,explicitlyReconfirmedSourceRecovered:true,coins:final.coins,revisionUnchanged:19,noGameCommandIssued:true,finalStateSha256:sha(JSON.stringify(final))};
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};throw error;}
finally{report.finishedAt=new Date().toISOString();await save();for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
console.log(JSON.stringify({status:report.status,actualCommands:report.commands.length,backup:report.backup,errors:report.errors}));
