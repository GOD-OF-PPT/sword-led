import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as sdk from '../../../dist/sword-led-v5.js';
export {assert,expect,sdk,readFile,writeFile};

export async function harness(out,url,initialRaw=null){
 await mkdir(out,{recursive:false});
 const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 const errors=[],observations=[],checks=[],actions=[],captures=[];
 page.on('pageerror',e=>errors.push(String(e)));
 if(initialRaw)await context.addInitScript(raw=>{if(!sessionStorage.getItem('isolated-restored-once')){for(const[k,v]of Object.entries(raw))if(v!==null)localStorage.setItem(k,v);sessionStorage.setItem('isolated-restored-once','true');}},initialRaw);
 async function raw(){return page.evaluate(()=>({save:localStorage.getItem('sword-led.save.v5'),collection:localStorage.getItem('sword-led.collection.v2')}));}
 async function actual(){const value=await raw();assert(value.save);const envelope=JSON.parse(value.save),valid=sdk.validateRun(envelope.state);assert(valid.ok,valid.detail);return valid.state;}
 async function keep(label){const value=await raw(),state=await actual(),collection=value.collection?JSON.parse(value.collection).state:null;if(collection)assert(sdk.validateCollection(collection).ok);observations.push({label,state,collection,raw:value});await writeFile(`${out}/states.json`,JSON.stringify(observations,null,2));return state;}
 async function unchanged(label,run){const before=await actual();await run();assert.deepEqual(await actual(),before,label);checks.push({label,ok:true});}
 async function capture(label){
  const before=await actual();
  for(const size of[{width:1280,height:720},{width:1920,height:1080}]){
   await page.setViewportSize(size);await page.screenshot({path:`${out}/${label}-${size.width}.png`});
   const bounds=await page.evaluate(()=>{
    const ids=['v4-customer-zone','v4-goal-name','v4-order-routes','v4-inline-delivery','v4-deliver','v4-settle','v4-event','v4-shop','v4-stage','v4-stage-copy','v4-stage-actions','v4-dialog','v4-dialog-body','v4-dialog-actions'];
    return ids.map(id=>{const n=document.getElementById(id);if(!n||!n.getClientRects().length||n.closest('[hidden]'))return{id,visible:false};const r=n.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2,hit=document.elementFromPoint(cx,cy);return{id,visible:true,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},centerOwned:hit===n||n.contains(hit),disabled:n.matches(':disabled'),scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,text:n.innerText};});
   });captures.push({label,size,bounds});
  }await page.setViewportSize({width:1280,height:720});assert.deepEqual(await actual(),before,`${label} resize/capture zero commands`);await writeFile(`${out}/captures.json`,JSON.stringify(captures,null,2));
 }
 async function close(){if(await page.locator('#v4-dialog').isVisible()){const buttons=page.locator('#v4-dialog-actions').getByRole('button');const back=buttons.filter({hasText:/^(回铁砧|收好炉谱|收好作品|暂不决定|不换，保留剑)$/});assert(await back.count()>0);await back.first().click();}}
 async function leaveIntro(){if(await page.locator('#v4-stage').isVisible()&&await page.locator('#v4-stage').getAttribute('data-scene')==='intro')await unchanged('chapter intro leave is zero economy',async()=>{const s=await actual();await capture(`d${s.day}-intro`);await page.locator('#v4-stage-actions').getByRole('button',{name:'回到铁砧',exact:true}).click();});}
 async function select(id){const node=page.locator(`#v4-inventory button[data-piece="${id}"]`);await expect(node).toBeVisible();if(await node.getAttribute('aria-pressed')!=='true')await node.click();}
 async function confirm(){await page.locator('#v4-dialog-actions').getByRole('button',{name:'确认',exact:true}).click();}
 async function ui(action,index){
  await leaveIntro();const before=await actual(),expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(expected.ok,`${index} ${JSON.stringify(action)} ${JSON.stringify(expected)}`);
  if(action.type==='continue')await page.locator('#v4-stage-actions').getByRole('button',{name:'点火开炉',exact:true}).click();
  else if(action.type==='strike'){await select(action.pieceId);await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');}
  else if(action.type==='deliver'){
   await select(action.pieceId);const item=sdk.getRunView(before).blades.find(p=>p.blade.id===action.pieceId);await expect(page.locator('#v4-deliver')).toContainText(item.quote.amount.toLocaleString('zh-CN'));
   if(before.day===1){const source=await page.locator(`#v4-inventory button[data-piece="${action.pieceId}"]`).boundingBox(),target=await page.locator('.v4-objective').boundingBox();assert(source&&target);await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:16});await page.mouse.up();}else await page.locator('#v4-deliver').click();
   const e=expected.events.find(e=>e.type==='Delivered');await expect(page.locator('#v4-coins')).toHaveText(expected.state.coins.toLocaleString('zh-CN'));
   if(expected.events.some(e=>e.type==='MainCompleted'))await expect(page.locator('#v5-inline-payment')).toHaveText(`实收 ${e.amount.toLocaleString('zh-CN')} 铜钱 · 酬劳${e.baseFeeDelta}＋品质${e.qualityBonus}`);
   else if(e.matched){await expect(page.locator('#v4-notice-copy')).toContainText(`这柄实收${e.amount.toLocaleString('zh-CN')}铜钱`);await expect(page.locator('#v4-notice-copy')).toContainText(`酬劳${e.baseFeeDelta}＋品质${e.qualityBonus}`);}
   checks.push({label:`d${before.day} ${action.pieceId} visible payment`,amount:e.amount,baseFeeDelta:e.baseFeeDelta,qualityBonus:e.qualityBonus,partial:!expected.events.some(e=>e.type==='MainCompleted'),paper:await page.locator('#v4-goal-progress').textContent(),notice:await page.locator('#v4-notice-copy').textContent(),inlinePayment:await page.locator('#v5-inline-payment').textContent()});
  }
  else if(action.type==='claimGift'){if(await page.locator('#v4-gift button').isVisible())await page.locator('#v4-gift button').click();else await page.locator('#v4-inline-review').click();await page.locator('#v4-dialog-body').getByRole('button',{name:`学会${sdk.TRAITS[action.traitId].name}`,exact:true}).click();}
  else if(action.type==='upgrade'){await page.locator('#v4-shop').click();await capture(`d${before.day}-shop-before-upgrade`);await page.locator('#v4-dialog-body').getByRole('button',{name:'准备更好的铁料',exact:true}).click();await confirm();}
  else if(action.type==='reserve'){
   if(before.reserveId===action.pieceId)await page.locator('#v4-reserve-slot button').click();
   else{await select(action.pieceId);await page.locator('#v4-reserve').click();if(before.reserveId)await confirm();}
  }
  else if(action.type==='settle'){await page.locator('#v4-settle').click();const p=sdk.getRunView(before).settlement;await expect(page.locator('#v4-dialog-body')).toContainText(`余下${p.remaining.length}柄共回收${p.recovered}铜钱`);for(const row of p.recoveries)await expect(page.locator('#v4-dialog-body')).toContainText(`→ 回收${row.amount}`);if([4,8,11,12].includes(before.day))await capture(`d${before.day}-settlement`);await confirm();}
  else if(action.type==='advance')await page.locator('#v4-stage-actions').getByRole('button',{name:'沿灯路，去下一天',exact:true}).click();
  else if(action.type==='chooseModification'){await capture(`d${before.day}-modification-choice`);await page.locator('#v4-stage-copy').getByRole('button',{name:`装上${sdk.MODIFICATIONS[action.modification].name}`,exact:true}).click();}
  else if(action.type==='chooseEvent'){await page.locator('#v4-event').click();if(action.choice==='decline')await page.locator('#v4-dialog-actions').getByRole('button',{name:'拒绝，保留眼前资源',exact:true}).click();else{if(action.pieceId)await page.locator(`[data-event-piece="${action.pieceId}"] button`).click();else await page.locator('#v4-dialog-body').getByRole('button',{name:/^接受/}).click();await confirm();}}
  else throw new Error(`Unhandled guide ${JSON.stringify(action)}`);
  await expect.poll(async()=>(await actual()).revision).toBe(expected.state.revision);assert.deepEqual(await actual(),expected.state);actions.push({index,day:before.day,action,accepted:true,revision:expected.state.revision,coinsBefore:before.coins,coinsAfter:expected.state.coins,events:expected.events});await writeFile(`${out}/actions.json`,JSON.stringify(actions,null,2));return keep(`a${index}-${action.type}`);
 }
 async function fail(e){await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify({message:String(e),stack:e.stack,actions:actions.length,checks,errors,body:await page.locator('body').innerText()},null,2));}
 async function finish(result){assert.equal(errors.length,0,JSON.stringify(errors));await writeFile(`${out}/result.json`,JSON.stringify({ok:true,url,browser:'isolated Chromium',actions:actions.length,observations:observations.length,checks,errors,captures:captures.length,...result},null,2));console.log(JSON.stringify({ok:true,out,actions:actions.length,observations:observations.length}));}
 return{out,url,browser,context,page,errors,observations,checks,actions,captures,raw,actual,keep,unchanged,capture,close,leaveIntro,select,confirm,ui,fail,finish,dispose:async()=>{await context.close();await browser.close();}};
}
