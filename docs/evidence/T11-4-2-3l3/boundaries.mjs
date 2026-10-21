import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as sdk from '../../dist/sword-led-v5.js';
import * as oldSdk from '../../dist/sword-led-v4.js';
const out='tmp/T11-4-2-3l3/boundaries',url='http://127.0.0.1:4209/';await mkdir(out,{recursive:false});
const oldRun=JSON.parse(await readFile('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8'));
const oldAwards=oldSdk.collectionFromRun(oldRun);assert(oldAwards.ok);
const storage=new Map(),oldRepo=oldSdk.createV4SaveRepository(()=>({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}));oldRepo.load();assert(oldRepo.write(oldRun).ok);
storage.set('sword-led.collection.v1',JSON.stringify({schemaVersion:1,rulesVersion:'forge-v4-collection-v1',savedAt:'2026-10-21T00:00:00.000Z',state:oldAwards.state}));
const browser=await chromium.launch(),errors=[],states=[],collections=[];let commands=0;
try{
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(rows=>{if(!sessionStorage.getItem('boundary-seeded')){for(const[k,v]of rows)localStorage.setItem(k,v);sessionStorage.setItem('boundary-seeded','yes');}},[...storage]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await expect(page.locator('.v5-app')).toBeVisible();await expect(page.locator('#v5-old-v4')).toContainText('第12天');
 await page.locator('#v5-old-v4').click();await expect(page).toHaveURL(/\/v4.html$/);await expect(page.locator('#v4-continue')).toBeEnabled();
 assert.equal(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4')),storage.get('sword-led.save.v4'));
 await page.goto(url);await expect(page.locator('#v4-start')).toBeEnabled();
 await page.locator('.v4-journey-options summary').click();await page.locator('#v4-seed').fill('v5-purse-0');await page.locator('#v4-start').click();
 async function observed(label){const state=JSON.parse(await page.evaluate(()=>localStorage.getItem('sword-led.save.v5'))).state;assert(sdk.validateRun(state).ok);states.push({label,state});return state;}
 async function act(action,input){const before=await observed('before-'+action.type),expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(expected.ok);await input();await expect.poll(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('sword-led.save.v5'))).state.revision).toBe(expected.state.revision);const actual=await observed('after-'+action.type);assert.deepEqual(actual,expected.state);commands++;return actual;}
 async function strike(id){await page.locator(`#v4-inventory button[data-piece="${id}"]`).click();await act({type:'strike',pieceId:id},()=>page.locator('#v4-hit').click({position:{x:250,y:170},force:true}));await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');}
 await act({type:'continue'},()=>page.getByRole('button',{name:'点火开炉',exact:true}).click());
 for(let i=0;i<3;i++)await strike('d1-1');
 const ready=await observed('ready'),quote=sdk.getRunView(ready).blades.find(p=>p.blade.id==='d1-1').quote;await expect(page.locator('#v4-deliver')).toContainText(String(quote.amount));
 await act({type:'deliver',pieceId:'d1-1'},()=>page.locator('#v4-deliver').click());
 for(const size of [{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);await page.screenshot({path:`${out}/receipt-${size.width}.png`});}
 await page.setViewportSize({width:1280,height:720});
 for(let i=0;i<4;i++)await strike('d1-2');
 await act({type:'deliver',pieceId:'d1-2'},()=>page.locator('#v4-deliver').click());
 const empty=await observed('empty-purse');assert.equal(sdk.marketRemaining(empty),0);await expect(page.locator('#v4-deliver')).toBeDisabled();await expect(page.locator('#v5-delivery-quote')).toContainText('钱袋已空');await page.screenshot({path:`${out}/empty-purse-1280.png`});
 await page.locator('#v4-scrap').click();await expect(page.locator('#v4-dialog-body')).toContainText('实得0');assert.deepEqual(await observed('zero-recovery-unconfirmed'),empty);await page.getByRole('button',{name:'再想想',exact:true}).click();
 await page.locator('#v4-book').click();const beforePreview=await page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
 await page.getByRole('button',{name:'旧炉谱主册导入',exact:true}).click();await expect(page.locator('#v4-dialog-title')).toHaveText('把旧炉谱带上路');
 assert.equal(await page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))),beforePreview);
 await page.screenshot({path:`${out}/legacy-preview-1280.png`});
 await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('sword-led.collection.v1'));v.savedAt='2026-10-21T00:00:01.000Z';localStorage.setItem('sword-led.collection.v1',JSON.stringify(v));});
 await page.getByRole('button',{name:'确认导入这份炉谱',exact:true}).click();await expect(page.locator('#v4-dialog-title')).toHaveText('旧炉谱已更新，请再看一次');assert.equal(await page.evaluate(()=>localStorage.getItem('sword-led.collection.v2')),null);
 await page.getByRole('button',{name:'重新预览',exact:true}).click();await page.getByRole('button',{name:'暂不导入',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('sword-led.collection.v2')),null);
 await page.locator('#v4-book').click();await page.getByRole('button',{name:'旧炉谱主册导入',exact:true}).click();await page.getByRole('button',{name:'确认导入这份炉谱',exact:true}).click();await expect(page.locator('#v4-dialog-title')).toHaveText('炉谱 · 带得走的手艺');
 await expect(page.locator('.v5-source-label').first()).toContainText('旧行程');assert.deepEqual(await observed('after-import-current-frozen'),empty);
 const collection=JSON.parse(await page.evaluate(()=>localStorage.getItem('sword-led.collection.v2'))).state;assert(sdk.validateCollection(collection).ok);collections.push(collection);
 await page.screenshot({path:`${out}/collection-source-1280.png`});await page.getByRole('button',{name:'收好炉谱',exact:true}).click();
 await page.locator('#v4-menu').click();await page.getByRole('button',{name:'回标题',exact:true}).click();await page.locator('#v4-start').click();await page.getByRole('button',{name:'确认',exact:true}).click();
 const fresh=await observed('fresh-after-import');assert.equal(fresh.coins,0);assert.deepEqual(fresh.traits,[]);assert.equal(fresh.upgradeCount,0);assert.deepEqual(fresh.initialEligibility.recipes,['light','guard','heavy']);assert(fresh.initialEligibility.challenge);
 assert.equal(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4')),storage.get('sword-led.save.v4'));
 assert.equal(errors.length,0);await writeFile(`${out}/result.json`,JSON.stringify({ok:true,scope:'specific real UI quote/zero-price/old-entry/import cases; not another full chapter or compatibility matrix',acceptedCommands:commands,states,collections,oldRunPreserved:true,previewZeroWrites:true,sourceChangeRejected:true,cancelZeroWrites:true,currentRunFrozen:true,newRunResourcesNotMigrated:true,errors},null,2)+'\n');
 console.log(JSON.stringify({ok:true,acceptedCommands:commands,observations:states.length,collections:collections.length,errors}));
}catch(error){await writeFile(`${out}/failure.json`,JSON.stringify({message:String(error),stack:error.stack,acceptedCommands:commands,states,errors},null,2));throw error;}finally{await browser.close();}
