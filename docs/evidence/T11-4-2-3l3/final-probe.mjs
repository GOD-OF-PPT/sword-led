import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as sdk from '../../dist/sword-led-v5.js';
const out='tmp/T11-4-2-3l3/final-probe';await mkdir(out,{recursive:false});
const records=JSON.parse(await readFile('tmp/T11-4-2-3l3/ui/run-02/states.json','utf8'));
const ready=records.filter(o=>o.state.day===1&&o.state.phase==='workshop'&&o.state.blades.find(b=>b.id==='d1-1')?.status==='active').at(-1).state;
const reserved=records.find(o=>o.state.day===4&&o.state.reserveId==='d4-2'&&o.state.phase==='workshop').state;
const final=records.find(o=>o.state.day===4&&o.state.phase==='summary').state;
const browser=await chromium.launch(),errors=[],states=[],checks=[];
async function setup(state){
 assert(sdk.validateRun(state).ok);const map=new Map(),repo=sdk.createV5SaveRepository(()=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}));repo.load();assert(repo.write(state).ok);
 const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(raw=>localStorage.setItem('sword-led.save.v5',raw),map.get('sword-led.save.v5'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4209/');await expect(page.locator('#v4-continue')).toBeEnabled();await page.locator('#v4-continue').click();return{page,close:()=>context.close()};
}
async function keep(page,label){const state=JSON.parse(await page.evaluate(()=>localStorage.getItem('sword-led.save.v5'))).state;assert(sdk.validateRun(state).ok);states.push({label,state});return state;}
try{
 {
  const{page,close}=await setup(ready);const before=await keep(page,'ready-restored'),id='d1-1',expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'deliver',pieceId:id}});assert(expected.ok);
  await page.locator('#v4-deliver').click();await expect(page.locator('#v5-inline-payment')).toBeVisible();assert.deepEqual(await keep(page,'actual-delivery'),expected.state);
  await page.waitForTimeout(1100);
  for(const size of[{width:1280,height:720},{width:1920,height:1080}]){
   await page.setViewportSize(size);const info=await page.evaluate(()=>{const button=document.querySelector('#v4-deliver'),b=button.getBoundingClientRect(),receipt=document.querySelector('#v4-inline-delivery').getBoundingClientRect(),plan=document.querySelector('.v4-forge-plan').getBoundingClientRect(),slot=document.querySelector('#v5-slot-plan'),slotBox=slot.getBoundingClientRect(),rack=document.querySelector('.v4-rack').getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{buttonOwnsCenter:button===hit||button.contains(hit),buttonTop:b.top,receiptBottom:receipt.bottom,settleTop:document.querySelector('#v4-settle').getBoundingClientRect().top,buttonBottom:b.bottom,planHeight:plan.height,slotBox:{left:slotBox.left,right:slotBox.right},rack:{left:rack.left,right:rack.right}};});assert(info.buttonOwnsCenter&&info.buttonTop>=info.receiptBottom&&info.buttonBottom<info.settleTop);assert(info.planHeight<130);assert(info.slotBox.left>=info.rack.left&&info.slotBox.right<=info.rack.right);checks.push({size,...info});await page.screenshot({path:`${out}/paid-${size.width}.png`});
  }await close();
 }
 {
  const{page,close}=await setup(reserved);await page.locator('#v4-menu').click();await page.locator('#v4-journey-open').click();await expect(page.locator('#v4-dialog-body')).toContainText('明日1柄旧剑＋2柄新坯，共3柄');await expect(page.locator('#v4-dialog-body')).toContainText('取下旧剑不补发');assert.deepEqual(await keep(page,'journey-real-three-slots'),reserved);await page.screenshot({path:`${out}/journey-three-slots-1280.png`});await page.getByRole('button',{name:'回铁砧',exact:true}).click();await expect(page.locator('#v5-slot-plan')).toHaveText('明日：旧剑1 ＋ 新坯2');await close();
 }
 {
  const{page,close}=await setup(final);await expect(page.locator('#v4-stage')).toHaveAttribute('data-scene','complete');await expect(page.locator('#v4-stage-copy')).toContainText('本次旅程开放第一章');await expect(page.locator('#v4-stage-copy')).toContainText('已装炉具：余温架');await expect(page.locator('#v4-stage-actions').getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);assert.deepEqual(await keep(page,'final-summary-boundary'),final);for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);await page.screenshot({path:`${out}/summary-${size.width}.png`});}await close();
 }
 assert.equal(errors.length,0);await writeFile(`${out}/result.json`,JSON.stringify({ok:true,scope:'final targeted visual/copy fix recheck; legal restores from actual UI first-chapter run, not another full run',actualAcceptedCommands:1,states,checks,errors},null,2)+'\n');console.log(JSON.stringify({ok:true,actualAcceptedCommands:1,savedObservations:states.length,checks:checks.length,errors}));
}finally{await browser.close();}
