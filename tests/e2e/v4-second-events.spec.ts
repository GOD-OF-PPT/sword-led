import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import * as kernel from '../../src/core-v4/index.js';
import type {Action,CreateRunInput,DomainEvent,EventId,Trait} from '../../src/core-v4/index.js';
import {startV4,readV4,commandV4,saveV4,shotV4,exitDelivery} from './v4-helpers.js';
import {buildEventPlan} from './v4-event-plans.js';

const seedFixture=JSON.parse(readFileSync('tests/fixtures/v4/event-route-seeds.json','utf8'))as{seeds:Record<EventId,{seed:string;prefixCommands:number}>};
const giftFixture=JSON.parse(readFileSync('tests/fixtures/v4/delayed-gift-route.json','utf8'))as{input:CreateRunInput;actions:Action[];missing:Trait;replaceId:Trait};
const IDS:readonly EventId[]=['donation','loan','salvage','credit','shelter','rest'];
function fourSwordGiftPlan(){
 const made=kernel.createRun(giftFixture.input);if(!made.ok)throw Error(made.error);let state=made.state;const actions:Action[]=[];
 const send=(action:Action)=>{const r=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)throw Error(r.error);actions.push(action);state=r.state;};
 for(const action of giftFixture.actions){if(action.type==='settle'&&state.day===6){const kept=state.blades.filter(b=>b.status==='active'&&b.id!==state.reserveId).at(-1);if(!kept)throw Error('No genuine spare for layout route');send({type:'reserve',pieceId:kept.id});}send(action);}
 if(!kernel.validateRun(state).ok)throw Error('Invalid full-rack route');return actions;
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const found:string[]=[];errors.set(page,found);page.on('pageerror',error=>found.push(error.message));page.on('response',response=>{if(response.status()>=400)found.push(`${response.status()} ${response.url()}`);});});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));

async function resumeExact(page:Page){const state=await readV4(page),bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));await page.reload();await expect(page.locator('#v4-continue')).toBeEnabled();await page.locator('#v4-continue').click();expect(await readV4(page)).toEqual(state);expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'))).toBe(bytes);return state;}
function chosenEvent(events:readonly DomainEvent[]){const event=events.find(e=>e.type==='EventChoice');if(event?.type!=='EventChoice')throw Error('No event choice in the accepted command');return event.record;}

for(const id of IDS)for(const choice of ['accept','decline']as const)test(`real ${id} ${choice} reaches its next day once and survives refresh without repeating the consequence`,async({page})=>{
  test.setTimeout(120000);const seed=seedFixture.seeds[id];expect(seed.prefixCommands).toBe(8);const plan=buildEventPlan(kernel,seed.seed,id,choice);await startV4(page,seed.seed);
  let final=await readV4(page),loanHits=0,firstCredit=false,brokenAfterCredit=false;
  for(const action of plan.actions){
    const before=await readV4(page),oracle=kernel.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!oracle.ok)throw Error(oracle.error);
    if(action.type==='chooseEvent'){
      await page.locator('#v4-event-open').click();await expect(page.locator(`#v4-dialog-body canvas[data-prop="${id}"]`)).toBeVisible();
      // Inspect the real selectable object, including three equally priced fresh blades.
      if(choice==='accept'&&(id==='donation'||id==='salvage'))await expect(page.locator('#v4-dialog-body [data-event-piece="d3-1"]')).toBeVisible();
      await page.getByRole('button',{name:'暂不决定',exact:true}).click();expect(await readV4(page)).toEqual(before);
    }
    final=await commandV4(page,action);
    if(action.type==='chooseEvent'){
      const record=chosenEvent(oracle.events);expect(record).toMatchObject({day:3,id,choice});expect(final.eventHistory.filter(e=>e.day===3)).toHaveLength(1);expect(final.eventStatus).toBe(choice==='accept'?'accepted':'declined');
      const delta=choice==='decline'?0:id==='loan'?-60:id==='shelter'?-80:id==='credit'?-90:id==='salvage'?160:0;expect(final.coins-before.coins).toBe(delta);expect(record.coins).toBe(delta);
      if(choice==='decline'){expect(final.blades).toEqual(before.blades);expect(final.pending).toEqual(before.pending);expect(final.crackGuard).toBe(false);}
      else if(id==='donation'){expect(final.blades.find(b=>b.id==='d3-1')?.status).toBe('donated');expect(final.pending.supplyPct).toBe(120);expect(record.pieceId).toBe('d3-1');}
      else if(id==='salvage'){expect(before.reserveId).toBe('d3-1');expect(final.reserveId).toBeNull();expect(final.blades.find(b=>b.id==='d3-1')?.status).toBe('bartered');expect(record.pieceId).toBe('d3-1');}
      else if(id==='credit')expect(final.crackGuard).toBe(true);
      else if(id==='loan')expect(final.pending.loan).toBe(true);
      else if(id==='shelter')expect(final.pending.shelter).toBe(true);
      else {expect(final.blades).toEqual(before.blades);expect(final.pending).toEqual(before.pending);}
      await expect(page.locator('#v4-event-open')).toBeHidden();await saveV4(page,`${id}-${choice}-once`);await resumeExact(page);await expect(page.locator('#v4-event-open')).toBeHidden();
    }
    if(action.type==='settle'&&before.day===3){await expect(page.locator('#v4-stage-copy')).toContainText(kernel.EVENTS[id].name);await expect(page.locator('#v4-stage-copy')).toContainText(choice==='accept'?'已接受':'已婉拒');}
    if(action.type==='advance'&&before.day===3){
      expect(final.day).toBe(4);expect(final.phase).toBe('workshop');expect(final.eventHistory).toHaveLength(1);expect(final.pending).toEqual({supplyPct:100,loan:false,shelter:false});
      const base=choice==='accept'&&id==='donation'?48:40;expect(final.supplyBase).toBe(base);expect(final.blades.filter(b=>b.suppliedDay===4).map(b=>b.base)).toEqual([base,base,base]);
      expect(final.dayBuffs).toEqual({supplyPct:base===48?120:100,loan:choice==='accept'&&id==='loan',shelter:choice==='accept'&&id==='shelter'});await saveV4(page,`${id}-${choice}-next-day`);await resumeExact(page);
    }
    if(action.type==='strike'&&before.day===4){
      const strike=oracle.events.find(e=>e.type==='Strike');if(strike?.type!=='Strike')throw Error('Missing actual-state strike replay');
      if(id==='loan'&&choice==='accept')for(const hit of strike.hits){const prior=before.blades.find(b=>b.id===action.pieceId)!;if(action.pieceId==='d4-1'&&prior.hits<3){expect(hit.triggers).toContain('loan');loanHits++;}else expect(hit.triggers).not.toContain('loan');}
      if(id==='shelter'&&choice==='accept'){
        for(const hit of strike.hits)expect(hit.triggers.includes('shelter')).toBe(action.pieceId==='d4-1');
        const p=kernel.getRunView(final).blades.find(p=>p.blade.id===action.pieceId)!;
        if(p.blade.hits===3){expect(p.odds.crack).toBe(action.pieceId==='d4-1'?0:30);await expect(page.locator('#v4-risk')).toContainText(action.pieceId==='d4-1'?'裂损 0%':'裂损 3%');}
      }
      if(id==='credit'&&choice==='accept')for(const hit of strike.hits){
        if(hit.result==='crack'){firstCredit=true;expect(before.crackGuard).toBe(true);expect(hit.triggers).toContain('credit');expect(hit.after).toBe(hit.before);expect(final.crackGuard).toBe(false);await saveV4(page,'credit-actually-consumed');await resumeExact(page);}
        if(hit.result==='broken'){brokenAfterCredit=true;expect(before.crackGuard).toBe(false);expect(hit.triggers).not.toContain('credit');expect(final.blades.find(b=>b.id===action.pieceId)?.status).toBe('broken');expect(final.coins-before.coins).toBe(Math.floor(before.blades.find(b=>b.id===action.pieceId)!.base/4));}
      }
    }
  }
  if(id==='loan'&&choice==='accept'){expect(loanHits).toBe(3);expect(final.blades.find(b=>b.id==='d4-1')?.value).toBe(162);expect(final.blades.find(b=>b.id==='d4-2')?.value).toBe(56);}
  if(id==='credit'&&choice==='accept'){expect(firstCredit).toBe(true);expect(brokenAfterCredit).toBe(true);expect(final.crackGuard).toBe(false);}
  expect(final.day).toBe(4);expect(final.eventHistory).toHaveLength(1);await resumeExact(page);await saveV4(page,`${id}-${choice}-final-stable`);
});

test('a genuinely delayed first gift can cancel and replace a full slot without paying a sword or renewing a used pardon',async({page})=>{
  test.setTimeout(240000);const actions=fourSwordGiftPlan();await startV4(page,giftFixture.input.seed);for(const action of actions)await commandV4(page,action);await exitDelivery(page);const before=await saveV4(page,'delayed-gift-real-83-commands');
  expect(before.revision).toBe(83);expect(before.phase).toBe('workshop');expect(before.blades.filter(b=>b.status==='active')).toHaveLength(4);expect(before.traits).toHaveLength(3);expect(before.traits).toContain(giftFixture.replaceId);expect(before.traits).not.toContain(giftFixture.missing);expect(before.gift).toBe('available');expect(before.pardonUsed).toBe(true);await expect(page.locator('#v4-traits [data-trait="pardon"]')).toContainText('已用');
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Object.assign(window,{v4GiftRestoreStorage:()=>{Storage.prototype.setItem=set;}});Storage.prototype.setItem=function(k,v){if(k==='sword-led.settings.v1')throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v);};});
  await page.locator('#v4-settings').click();await page.getByLabel('静音',{exact:true}).check();await page.getByRole('button',{name:'收好',exact:true}).click();await expect(page.locator('#v4-save-summary')).toContainText('设置尚未保存');
  for(const [width,height]of [[1280,720],[1920,1080]]){
    await page.setViewportSize({width:width!,height:height!});
    const hit=await page.locator('#v4-inventory button,#v4-reserve-slot button,#v4-traits button,#v4-gift button,#v4-modifications button,#v4-save-open').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{text:n.textContent,width:r.width,height:r.height,visible:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,unblocked:!!top&&n.contains(top)};}));
    expect(hit).toHaveLength(10);for(const target of hit){expect(target.visible,target.text??'').toBe(true);expect(target.unblocked,target.text??'').toBe(true);expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);}await shotV4(page,`full-rack-three-traits-gift-error-${width}`);
  }
  expect(await readV4(page)).toEqual(before);await page.evaluate(()=>{(window as unknown as {v4GiftRestoreStorage:()=>void}).v4GiftRestoreStorage();});
  await page.locator('#v4-gift button').click();await page.getByRole('button',{name:'学会'+kernel.TRAITS[giftFixture.missing].name,exact:true}).click();await expect(page.locator('#v4-dialog-title')).toContainText('行囊已满');await page.getByRole('button',{name:'换下'+kernel.TRAITS[giftFixture.replaceId].name,exact:true}).click();await page.getByRole('button',{name:'再想想',exact:true}).click();expect(await readV4(page)).toEqual(before);
  const after=await commandV4(page,{type:'claimGift',traitId:giftFixture.missing,replaceId:giftFixture.replaceId});expect(after.coins).toBe(before.coins);expect(after.blades).toEqual(before.blades);expect(after.reserveId).toBe(before.reserveId);expect(after.gift).toBe('claimed');expect(after.pardonUsed).toBe(true);expect(after.traits).toContain(giftFixture.missing);expect(after.traits).not.toContain(giftFixture.replaceId);expect(after.traits).toHaveLength(3);await expect(page.locator('#v4-gift button')).toHaveCount(0);await resumeExact(page);await saveV4(page,'delayed-gift-replaced-without-price');await shotV4(page,'three-traits-free-gift-keeps-pardon-used');
});
