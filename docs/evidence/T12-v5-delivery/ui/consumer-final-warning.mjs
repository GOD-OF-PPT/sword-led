import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as sdk from '../../../dist/sword-led-v5.js';
const out=process.argv[2]??'tmp/T12-v5-delivery/ui/run-01',url=process.argv[3]??'http://127.0.0.1:4210/';
await mkdir(out,{recursive:false});
const fixture=JSON.parse(await readFile('tmp/T12-v5-delivery/ui/fixture.json','utf8')),MAIN=sdk.V5_SAVE_KEY,BACKUP=sdk.V5_BACKUP_KEY;
assert.equal(sdk.decodeV5Save(fixture.backupRaw).status,'valid');assert.equal(sdk.decodeV5Save(fixture.badMain).status,'invalid');assert.equal(sdk.decodeV5Save(fixture.futureMain).status,'invalid');
const browser=await chromium.launch(),cases=[],errors=[];
async function contextFor(main,denyMain=false){const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});await context.addInitScript(({MAIN,BACKUP,main,backup,denyMain})=>{
 const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem,originalClear=Storage.prototype.clear;
 if(originalGet.call(localStorage,MAIN)===null&&originalGet.call(localStorage,BACKUP)===null){originalSet.call(localStorage,MAIN,main);originalSet.call(localStorage,BACKUP,backup);}
 const writes=[];Object.defineProperty(window,'__rawExportTestSnapshot',{value:()=>({main:originalGet.call(localStorage,MAIN),backup:originalGet.call(localStorage,BACKUP),writes:structuredClone(writes)})});
 Storage.prototype.setItem=function(key,value){if(this===localStorage&&(key===MAIN||key===BACKUP))writes.push({method:'setItem',key,value});return originalSet.call(this,key,value);};
 Storage.prototype.removeItem=function(key){if(this===localStorage&&(key===MAIN||key===BACKUP))writes.push({method:'removeItem',key});return originalRemove.call(this,key);};
 Storage.prototype.clear=function(){if(this===localStorage)writes.push({method:'clear'});return originalClear.call(this);};
 if(denyMain)Storage.prototype.getItem=function(key){if(this===localStorage&&key===MAIN)throw new DOMException('Own-context test denies the main slot read','SecurityError');return originalGet.call(this,key);};
 },{MAIN,BACKUP,main,backup:fixture.backupRaw,denyMain});return context;}
async function snapshot(page){return page.evaluate(()=>window.__rawExportTestSnapshot());}
async function unchanged(page,before,label){const after=await snapshot(page);assert.deepEqual(after,before,label);assert.equal(after.writes.length,0,'no app slot mutation');return after;}
async function capture(page,label){const images=[];for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);const path=`${out}/${label}-${size.width}.png`;await page.screenshot({path});images.push({path,size});}await page.setViewportSize({width:1280,height:720});return images;}
async function saveDialog(page){await page.locator('#v4-save-open').click();await expect(page.locator('#v4-dialog-title')).toHaveText('把行程收好');await expect(page.locator('#v5-export-raw-run')).toBeEnabled();await expect(page.locator('#v4-continue')).not.toBeVisible();}
async function exportRaw(page,label,main,denyMain=false){await expect(page.locator('#v5-export-raw-run')).toBeEnabled();const before=await snapshot(page),downloadPromise=page.waitForEvent('download');await page.locator('#v5-export-raw-run').click();const download=await downloadPromise,path=`${out}/${label}.json`;await download.saveAs(path);const raw=await readFile(path,'utf8'),bundle=JSON.parse(raw);assert.equal(bundle.format,'sword-led.disk-run-export.v1');assert.equal(new Date(bundle.capturedAt).toISOString(),bundle.capturedAt);assert.deepEqual(bundle.slots.backup,{key:BACKUP,ok:true,raw:fixture.backupRaw});if(denyMain){assert.deepEqual(bundle.slots.main,{key:MAIN,ok:false,error:'storage_read_failed'});assert(!Object.hasOwn(bundle.slots.main,'raw'));await expect(page.locator('#v5-raw-export-status')).toContainText('1个位置读取失败');}else{assert.deepEqual(bundle.slots.main,{key:MAIN,ok:true,raw:main});await expect(page.locator('#v5-raw-export-status')).toContainText('不是可直接续玩的行程');}const after=await unchanged(page,before,label+' zero writes');return{download:path,suggestedFilename:download.suggestedFilename(),bundle,before,after,visibleStatus:await page.locator('#v5-raw-export-status').textContent()};}
try{
 for(const[name,main]of[['future-version',fixture.futureMain]]){
  const context=await contextFor(main),page=await context.newPage();page.on('pageerror',e=>errors.push({case:name,error:String(e)}));
  try{await page.goto(url);await expect(page.locator('#v4-start')).toBeEnabled();const initial=await snapshot(page);assert.deepEqual(initial,{main,backup:fixture.backupRaw,writes:[]});await saveDialog(page);const first=await exportRaw(page,name+'-writer',main);const images=await capture(page,name+'-exported');
   await page.locator('#v4-dialog-body').getByRole('button',{name:'恢复这份局备份',exact:true}).click();await expect(page.locator('#v4-dialog-body')).toContainText('原主档原文不会自动备份');images.push(...await capture(page,name+'-recovery-warning'));await page.locator('#v4-dialog-actions').getByRole('button',{name:'再想想',exact:true}).click();await unchanged(page,initial,name+' recovery cancel');
   await page.locator('#v4-start').click();await expect(page.locator('#v4-dialog-body')).toContainText('较新版主档不会自动保留到备份');await expect(page.locator('#v4-dialog-body')).toContainText('导出磁盘局档原文');await page.locator('#v4-dialog-actions').getByRole('button',{name:'再想想',exact:true}).click();await unchanged(page,initial,name+' new game cancel');
   let readonly=null;if(name==='bad-json'){const other=await context.newPage();other.on('pageerror',e=>errors.push({case:name+'-readonly',error:String(e)}));await other.goto(url);await expect(other.locator('#v4-save-summary')).toContainText('本页只读');await saveDialog(other);readonly=await exportRaw(other,name+'-readonly',main);images.push(...await capture(other,name+'-readonly-exported'));await unchanged(page,initial,'readonly page preserves writer raw');await other.close();}
   cases.push({name,mainKind:name,first,readonly,images,final:await unchanged(page,initial,name+' final'),domainCommands:0});
  }finally{await context.close();}
 }
 if(process.argv[4]==='include-read-denied'){
  const name='main-read-denied',main=fixture.badMain,context=await contextFor(main,true),page=await context.newPage();page.on('pageerror',e=>errors.push({case:name,error:String(e)}));
  try{await page.goto(url);await expect(page.locator('#v4-save-open')).toBeVisible();const initial=await snapshot(page);await saveDialog(page);const exported=await exportRaw(page,name,main,true);const images=await capture(page,name+'-failure-explicit');cases.push({name,exported,images,initial,final:await unchanged(page,initial,name+' final'),domainCommands:0});}finally{await context.close();}
 }
 assert.equal(errors.length,0,JSON.stringify(errors));await writeFile(`${out}/result.json`,JSON.stringify({ok:true,url,scope:'Final wording check: one future-version main with actual archived backup; actual download parse, restore/restart cancel, zero domain commands. Earlier three-case export contract run is separate.',source:fixture.source,cases,downloads:1,domainCommands:0,errors},null,2));console.log(JSON.stringify({ok:true,out,cases:cases.length,downloads:1,domainCommands:0}));
}catch(error){await writeFile(`${out}/failure.json`,JSON.stringify({message:String(error),stack:error.stack,cases,errors},null,2));throw error;}finally{await browser.close();}
