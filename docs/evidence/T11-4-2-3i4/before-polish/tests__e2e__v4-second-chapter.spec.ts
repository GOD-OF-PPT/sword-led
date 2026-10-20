import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import * as kernel from '../../src/core-v4/index.js';
import {validateCollection} from '../../src/application/v4-collection.js';
import {startV4,readV4,commandV4,secondChapterActions,exitDelivery,saveV4,shotV4,witness} from './v4-helpers.js';
import {buildSecondPlan} from './v4-second-plans.js';
import {heavyEvidence,installV4HammerProbe,setHeavySlowFrames} from './v4-heavy-probe.js';

const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const found:string[]=[];errors.set(page,found);page.on('pageerror',error=>found.push(error.message));page.on('response',response=>{if(response.status()>=400)found.push(`${response.status()} ${response.url()}`);});});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));

async function resumeUnchanged(page:Page){const before=await readV4(page),bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));await page.reload();await expect(page.locator('#v4-continue')).toBeEnabled();await page.locator('#v4-continue').click();expect(await readV4(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'))).toBe(bytes);return before;}
async function viewStations(page:Page){await page.locator('#v4-menu').click();await page.locator('#v4-journey-open').click();await expect(page.locator('#v4-dialog')).toBeVisible();await expect(page.locator('#v4-dialog-body img[data-journey-scene]')).toHaveAttribute('src','/assets/d/v07-chapter2/twin-stations-one-v1.webp');await expect(page.locator('#v4-dialog-body .v4-journey-works canvas[data-blade]')).toHaveCount(1);await expect(page.locator('#v4-dialog-body .v4-journey-works canvas[data-blade="d8-1"]')).toHaveCount(1);await shotV4(page,'one-station-real-review');await page.getByRole('button',{name:'回铁砧',exact:true}).click();}
async function proofCollection(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.collection.v1'));if(!raw)throw Error('Missing actual earned collection');const checked=validateCollection(JSON.parse(raw).state);if(!checked.ok)throw Error(checked.detail);return checked.state;}

test('real eight-day journey preserves old/cracked swords, heavy contact, partial refresh, two works and earned freedom',async({page},info)=>{
  test.setTimeout(300000);await startV4(page);let final=await readV4(page),crackConsumed=false;
  for(const [index,action]of secondChapterActions.entries()){
    const before=await readV4(page),revision=index+1;
    if(revision===103||revision===104){await page.setViewportSize(revision===103?{width:1280,height:720}:{width:1920,height:1080});await exitDelivery(page);await installV4HammerProbe(page);}
    if(revision===105){
      await exitDelivery(page);await setHeavySlowFrames(page,true);await installV4HammerProbe(page);await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
      const oracle=kernel.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!oracle.ok)throw Error(oracle.error);
      const box=await page.locator('#v4-hit').boundingBox();if(!box)throw Error('Missing heavy hit surface');await page.mouse.click(box.x+box.width*.59,box.y+box.height*.55);final=await readV4(page);expect(final).toEqual(oracle.state);
      await expect.poll(()=>page.evaluate(()=>window.v4HammerGeometry.complete),{timeout:8000}).toBe(true);await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','true');
      // At the second contact paint this real accepted strike is still completing its recoil.
      await page.keyboard.press('Escape');await expect(page.locator('#v4-dialog')).toBeVisible();await page.waitForTimeout(1300);expect(await readV4(page)).toEqual(final);await expect(page.locator('#v4-hammer')).toHaveAttribute('data-phase','idle');expect(await page.locator('#v4-scene').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);const probe=await heavyEvidence(page,info,'heavy-250ms-contact-cancelled',final);expect(probe.inputToFirstSampleMs).toBeGreaterThanOrEqual(240);await page.getByRole('button',{name:'继续锻造',exact:true}).click();await setHeavySlowFrames(page,false);expect(await readV4(page)).toEqual(final);
    }else final=await commandV4(page,action);
    if(revision===64){await expect(page.locator('#v4-stage-title')).toHaveText('第二章 · 风雪同行');await expect(page.getByRole('button',{name:'回到铁砧',exact:true})).toBeVisible();await saveV4(page,'second-chapter-entered');}
    if(revision===66){expect(final.blades.find(b=>b.id==='d4-2')).toMatchObject({status:'commissioned',suppliedDay:4,finalizedDay:5,value:536});await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07-chapter2/returning-blade-v1.webp');}
    if(action.type==='strike'&&final.day===6){const b=final.blades.find(b=>b.id===action.pieceId),prior=before.blades.find(b=>b.id===action.pieceId);if(b?.cracked&&!prior?.cracked){crackConsumed=true;expect(before.crackGuard).toBe(true);expect(final.crackGuard).toBe(false);expect(b.value).toBe(prior!.value);await expect(page.locator('#v4-condition')).toContainText('已有裂纹');await saveV4(page,'credit-consumed-by-real-crack');}}
    if(revision===103||revision===104)await heavyEvidence(page,info,`heavy-${revision===103?'1280':'1920'}-contact`,final);
    if(revision===117){expect(kernel.getRunView(final).commission.progress).toMatchObject({complete:false,routes:[{count:1,required:2}]});await expect(page.locator('#v4-goal-progress')).toHaveText('1/2');await expect(page.locator('#v4-workshop')).toBeVisible();await saveV4(page,'one-of-two-before-refresh');await resumeUnchanged(page);await expect(page.locator('#v4-workshop')).toBeVisible();await expect(page.locator('#v4-stage')).toBeHidden();await expect(page.locator('#v4-goal-progress')).toHaveText('1/2');await viewStations(page);}
    if(revision===120){expect(kernel.getRunView(final).commission.progress.pieceIds).toEqual(['d8-1','d8-2']);await expect(page.locator('#v4-stage-copy canvas[data-blade]')).toHaveCount(2);await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07-chapter2/twin-stations-lit-v1.webp');await expect(page.locator('#v4-stage-image')).toHaveCSS('object-fit','contain');await shotV4(page,'two-stations-two-real-swords');}
  }
  expect(crackConsumed).toBe(true);expect(final.day).toBe(8);expect(final.phase).toBe('summary');expect(final.history).toHaveLength(8);expect(final.history.every(h=>h.met)).toBe(true);expect(final.modifications).toEqual(['windbox','wideMouth']);await expect(page.locator('#v4-stage-title')).toHaveText('第二程，走完了');await expect(page.getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);await saveV4(page,'two-chapters-complete');
  const collection=await proofCollection(page);expect(collection.chapters).toEqual([1,2]);expect(collection.works.find(w=>w.commissionId===8)?.blades).toHaveLength(2);await resumeUnchanged(page);await expect(page.locator('#v4-stage-title')).toHaveText('第二程，走完了');
  await page.getByRole('button',{name:'翻开炉谱',exact:true}).click();await expect(page.locator('#v4-dialog-body [data-record="8"] canvas[data-blade]')).toHaveCount(2);await expect(page.locator('#v4-dialog-body')).toContainText('重锋：可自由使用');await page.getByRole('button',{name:'收好炉谱',exact:true}).click();await page.getByRole('button',{name:'带着炉谱，再启一程',exact:true}).click();await page.locator('#v4-start').click();await page.getByRole('button',{name:'确认',exact:true}).click();const fresh=await readV4(page);expect(fresh.initialEligibility.recipes).toEqual(['light','guard','heavy']);expect(fresh.coins).toBe(0);expect(fresh.modifications).toEqual([]);expect(fresh.traits).toEqual([]);await commandV4(page,{type:'continue'});await commandV4(page,{type:'setRecipe',pieceId:'d1-1',recipe:'heavy'});await expect(page.locator('#v4-blade')).toHaveAttribute('data-family','2');await saveV4(page,'legally-earned-heavy-new-journey');
});

for(const kind of ['warm','new']as const)test(`second-chapter ${kind==='warm'?'warm-rack old-sword':'no-old-sword new-630'} plan is a genuine complete UI journey`,async({page})=>{
  test.setTimeout(300000);const plan=buildSecondPlan(kernel,witness,kind);await startV4(page);let final=await readV4(page),proof=false;
  for(const action of plan.actions){
    const before=await readV4(page);final=await commandV4(page,action);
    if(action.type==='advance'&&before.day===4){
      await exitDelivery(page);
      if(kind==='warm'){const old=final.blades.find(b=>b.id==='d4-2')!,previous=before.blades.find(b=>b.id==='d4-2')!;expect(previous.value).toBe(536);expect(old.value).toBe(616);expect(old.charge).toBe(previous.charge);expect(old.cracked).toBe(previous.cracked);await expect(page.locator('#v4-reserve-slot')).toContainText('616');await resumeUnchanged(page);expect((await readV4(page)).blades.find(b=>b.id===old.id)?.value).toBe(616);await saveV4(page,'warm-rack-real-crossing');}
      else{expect(final.reserveId).toBeNull();expect(final.blades.filter(b=>b.status==='active').every(b=>b.suppliedDay===5)).toBe(true);}
    }
    if(action.type==='deliver'&&before.day===5&&final.blades.find(b=>b.id===action.pieceId)?.commissionId===5){const b=final.blades.find(b=>b.id===action.pieceId)!;proof=true;expect(b.suppliedDay).toBe(kind==='warm'?4:5);expect(b.value).toBeGreaterThanOrEqual(kind==='warm'?420:630);await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07-chapter2/returning-blade-v1.webp');await saveV4(page,`${kind}-real-day-five-work`);}
  }
  expect(proof).toBe(true);expect(final.day).toBe(8);expect(final.phase).toBe('summary');expect(final.history.every(h=>h.met)).toBe(true);expect(final.history.find(h=>h.day===5)?.routeId).toBe(kind==='warm'?'old':'new');expect(final.modifications).toEqual([kind==='warm'?'warmRack':'windbox','wideMouth']);await saveV4(page,`${kind}-genuine-eight-day-completion`);await shotV4(page,`${kind}-two-chapters`);
});
