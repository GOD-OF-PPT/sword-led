import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as sdk from '../../../dist/sword-led-v5.js';

const out=process.argv[2]??'tmp/T11-4-2-3l3/ui/run-01',url=process.argv[3]??'http://127.0.0.1:4209/';
await mkdir(out,{recursive:false});
const full=JSON.parse(await readFile('docs/evidence/T11-4-2-3l1/journeys/victory.json','utf8')).state;
const last=full.journal.findIndex(a=>a.type==='chooseModification');
assert(last>=0);
const guide=full.journal.slice(0,last+1),browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],observations=[],checks=[],actions=[];
page.on('pageerror',e=>errors.push(String(e)));
async function raw(){return page.evaluate(()=>({save:localStorage.getItem('sword-led.save.v5'),collection:localStorage.getItem('sword-led.collection.v2')}));}
async function actual(){const value=await raw();assert(value.save);const envelope=JSON.parse(value.save),valid=sdk.validateRun(envelope.state);assert(valid.ok,valid.detail);return valid.state;}
async function keep(label){const value=await raw(),state=await actual(),collection=value.collection?JSON.parse(value.collection).state:null;if(collection)assert(sdk.validateCollection(collection).ok);observations.push({label,state,collection});await writeFile(`${out}/states.json`,JSON.stringify(observations,null,2));return state;}
async function unchanged(label,run){const before=await actual();await run();assert.deepEqual(await actual(),before,label);checks.push({label,ok:true});}
async function capture(label){for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);await page.screenshot({path:`${out}/${label}-${size.width}.png`});}await page.setViewportSize({width:1280,height:720});}
async function close(){if(await page.locator('#v4-dialog').isVisible())await page.locator('#v4-dialog-actions').getByRole('button',{name:'回铁砧',exact:true}).click();}
async function select(id){const node=page.locator(`#v4-inventory button[data-piece="${id}"]`);await expect(node).toBeVisible();if(await node.getAttribute('aria-pressed')!=='true')await node.click();}
async function confirm(){await page.locator('#v4-dialog-actions').getByRole('button',{name:'确认',exact:true}).click();}
async function shopInspect(label,allowed){await unchanged(label,async()=>{await page.locator('#v4-shop').click();const offers=page.locator('#v4-dialog-body article').filter({has:page.locator('canvas')});const buttons=page.locator('#v4-dialog-body button').filter({hasText:allowed?'献':'需要等级至少3的成器'});assert(await buttons.count()>0);if(!allowed)for(const b of await buttons.all())assert(await b.isDisabled());await capture(label);await close();});}
async function ui(action,index){
 const before=await actual(),expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(expected.ok,`${index} ${JSON.stringify(action)} ${JSON.stringify(expected)}`);
 if(action.type==='continue')await page.locator('#v4-stage-actions').getByRole('button',{name:'点火开炉',exact:true}).click();
 else if(action.type==='strike'){await select(action.pieceId);await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');}
 else if(action.type==='deliver'){
  await select(action.pieceId);const view=sdk.getRunView(before),piece=view.blades.find(p=>p.blade.id===action.pieceId);await expect(page.locator('#v4-deliver')).toContainText(String(piece.quote.amount));
  if(before.day===1){const source=await page.locator(`#v4-inventory button[data-piece="${action.pieceId}"]`).boundingBox(),target=await page.locator('.v4-objective').boundingBox();assert(source&&target);await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:16});await page.mouse.up();}
  else await page.locator('#v4-deliver').click();
  const event=expected.events.find(e=>e.type==='Delivered');await expect(page.locator('#v5-inline-payment')).toHaveText(`实收 ${event.amount.toLocaleString('zh-CN')} 铜钱 · 酬劳${event.baseFeeDelta}＋品质${event.qualityBonus}`);await expect(page.locator('#v4-coins')).toHaveText(expected.state.coins.toLocaleString('zh-CN'));await capture(`d${before.day}-paid`);
 }
 else if(action.type==='claimGift'){if(await page.locator('#v4-gift button').isVisible())await page.locator('#v4-gift button').click();else await page.locator('#v4-inline-review').click();await page.locator('#v4-dialog-body').getByRole('button',{name:'学会稳手护符',exact:true}).click();}
 else if(action.type==='upgrade'){await page.locator('#v4-shop').click();await page.locator('#v4-dialog-body').getByRole('button',{name:'准备更好的铁料',exact:true}).click();await confirm();}
 else if(action.type==='reserve'){await select(action.pieceId);await expect(page.locator('#v5-slot-plan')).toContainText('明日新坯3');await page.locator('#v4-reserve').click();await expect(page.locator('#v5-slot-plan')).toHaveText('明日：留剑1 ＋ 新坯2');await capture('d4-reserve-three-slots');}
 else if(action.type==='settle'){await page.locator('#v4-settle').click();const settlement=sdk.getRunView(before).settlement;await expect(page.locator('#v4-dialog-body')).toContainText(`余下${settlement.remaining.length}柄共回收${settlement.recovered}铜钱`);for(const row of settlement.recoveries)await expect(page.locator('#v4-dialog-body')).toContainText(`→ 回收${row.amount}`);await capture(`d${before.day}-settlement`);await confirm();}
 else if(action.type==='advance')await page.locator('#v4-stage-actions').getByRole('button',{name:'沿灯路，去下一天',exact:true}).click();
 else if(action.type==='chooseModification')await page.locator('#v4-stage-copy').getByRole('button',{name:'装上余温架',exact:true}).click();
 else throw new Error(`Unhandled guide ${JSON.stringify(action)}`);
 await expect.poll(async()=>(await actual()).revision).toBe(expected.state.revision);assert.deepEqual(await actual(),expected.state);actions.push({index,day:before.day,action,accepted:true,revision:expected.state.revision,coinsBefore:before.coins,coinsAfter:expected.state.coins,events:expected.events});await writeFile(`${out}/actions.json`,JSON.stringify(actions,null,2));await keep(`a${index}-${action.type}`);
}
try{
 await page.goto(url);await expect(page.locator('.v5-app')).toHaveAttribute('data-rules-version','forge-v5');await expect(page.locator('#v5-old-v4')).toHaveAttribute('href','/v4.html');await expect(page.locator('#v5-old-v4')).toBeVisible();
 await page.locator('.v4-journey-options summary').click();await page.locator('#v4-seed').fill('v5-economy-0');await page.locator('#v4-start').click();
 const first=await keep('created-from-real-title');const created=sdk.createRun({runId:first.runId,seed:'v5-economy-0',mode:'story',eligibility:{recipes:['light'],challenge:false}});assert(created.ok);assert.deepEqual(first,created.state);
 for(let i=0;i<guide.length;i++){
  const s=await actual();
  if(s.day===3&&guide[i].type==='strike'&&s.revision===13){await select('d3-1');await shopInspect('d3-shop-raw',false);}
  await ui(guide[i],i);
  const after=await actual();
  if(after.day===3&&guide[i].type==='strike'&&guide[i].pieceId==='d3-2'&&after.blades.find(b=>b.id==='d3-2').level>=3&&!checks.some(c=>c.label==='d3-shop-formed'))await shopInspect('d3-shop-formed',true);
  if(after.day===3&&guide[i].type==='deliver')await unchanged('empty purse ordinary sale disabled',async()=>{const spare=sdk.getRunView(after).blades.find(p=>!p.reserved&&!p.willCommission);assert(spare);assert.equal(spare.quote.amount,0);await select(spare.blade.id);await expect(page.locator('#v4-deliver')).toBeDisabled();await expect(page.locator('#v5-delivery-quote')).toContainText('收购钱袋已空');await capture('d3-empty-purse');});
 }
 let final=await keep('chapter-one-summary');assert.equal(final.day,4);assert.equal(final.phase,'summary');assert.deepEqual(final.modifications,['warmRack']);await expect(page.locator('#v4-stage')).toHaveAttribute('data-scene','complete');await expect(page.locator('#v4-stage-actions').getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);await capture('chapter-one-complete');
 await page.reload();await expect(page.locator('#v4-continue')).toBeEnabled();await page.locator('#v4-continue').click();assert.deepEqual(await keep('real-reload-summary'),final);await expect(page.locator('#v4-stage')).toHaveAttribute('data-scene','complete');await expect(page.locator('#v4-stage-actions').getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(`${out}/result.json`,JSON.stringify({ok:true,url,browser:'isolated Chromium',method:'Empty fresh context; real title seed and pointer/buttons only; prior published legal guide fixed in advance; formal SDK replay equals each actual saved state; no injected save, economic commands or RNG adaptation',actions:actions.length,observations:observations.length,checks,errors,final:{runId:final.runId,day:final.day,phase:final.phase,revision:final.revision,coins:final.coins,seals:final.seals,history:final.history,modifications:final.modifications,reserveId:final.reserveId}},null,2));console.log(JSON.stringify({ok:true,out,actions:actions.length,observations:observations.length}));
}catch(e){await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify({message:String(e),stack:e.stack,actions:actions.length,checks,errors,body:await page.locator('body').innerText()},null,2));throw e;}finally{await context.close();await browser.close();}
