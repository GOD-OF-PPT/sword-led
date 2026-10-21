import {test,expect} from '@playwright/test';
import {KeyboardV5,v5Sdk} from './v5-helpers.js';
import {buildJourney} from './v5-plans.js';

for(const kind of ['two-new','mixed-return']as const)test(`fresh ${kind}: actual payments, partial reloads, final receipt and honest ending`,async({page},info)=>{
 test.setTimeout(360000);const mode=kind==='two-new'?'mouse':'keyboard',h=new KeyboardV5(page,info,mode);await h.install();await h.start('v5-economy-0');
 const initial=(await h.read()).state,plan=buildJourney(v5Sdk,{runId:initial.runId,seed:initial.seed},{preferOld:kind==='mixed-return',mixedRelay:kind==='mixed-return',skipDays:kind==='mixed-return'?[4]:[]});
 expect(plan.state.phase).toBe(kind==='two-new'?'victory':'return');let partials=0,oldDay5=false,newDay5=false;
 for(const action of plan.actions){
  const before=(await h.read()).state,current=await h.command(action),progress=v5Sdk.commissionProgress(current);
  if(kind==='mixed-return'&&before.day===4&&action.type==='settle'){await expect(page.locator('#v4-stage-title')).toContainText('渡口仍有缺口');await expect(page.locator('#v4-stage-copy')).toContainText('未完成的约定如实留下');await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07/bridge-dark-v1.webp');await h.capture('missed-bridge-real-chapter');}
  if(kind==='mixed-return'&&before.day===4&&action.type==='chooseModification'){expect((await h.read()).collection?.chapters).toContain(1);expect(current.history.find(day=>day.day===4)?.met).toBe(false);await expect(page.locator('#v4-stage-copy')).toContainText('仍有未竟的约定');}
  if(kind==='mixed-return'&&before.day===4&&action.type==='advance'&&before.reserveId){expect(current.blades.find(blade=>blade.id===before.reserveId)?.value).toBe(Math.floor(before.blades.find(blade=>blade.id===before.reserveId)!.value*115/100));}
  if(action.type==='advance'&&current.day===5){expect(current.blades.filter(b=>b.suppliedDay===5)).toHaveLength(kind==='two-new'?3:2);expect(current.reserveId===null).toBe(kind==='two-new');await h.capture(`${kind}-three-total-day-five`);}
  if(action.type==='deliver'&&before.day===5){expect(progress.routeId).toBe(kind==='two-new'?'new':'old');oldDay5=progress.routeId==='old';newDay5=progress.routeId==='new';}
  if(action.type==='deliver'&&[8,11].includes(before.day)&&!progress.complete){
   const q=v5Sdk.deliveryQuote(before,before.blades.find(b=>b.id===action.pieceId)!);expect(q.matched).toBe(true);expect(q.baseFeeDelta).toBe(before.day===8?125:300);expect(progress.routes.find(route=>route.required===2)?.count).toBe(1);
   partials++;await h.capture(`${kind}-day-${before.day}-one-of-two`);await h.reload();await h.activate(page.locator('#v4-continue'));const reloaded=await h.record(`${kind}-day-${before.day}-partial-reload`);expect(reloaded.state).toEqual(current);
  }
  if(action.type==='deliver'&&before.day===11&&progress.complete){
   expect(progress.routeId).toBe(kind==='two-new'?'two-new':'old');expect(progress.pieceIds).toEqual(kind==='two-new'?['d11-1','d11-2']:['d10-2']);
   if(kind==='mixed-return')expect(current.blades.filter(b=>b.commissionId===11&&b.status==='commissioned')).toHaveLength(2);
   await h.activate(page.locator('#v4-inline-review'));expect((await h.read()).state).toEqual(current);if(kind==='mixed-return')await expect(page.locator('#v4-stage-copy')).toContainText('不计作两柄新剑');
   await h.capture(`${kind}-relay-winning-receipt`);await h.activate(page.locator('#v4-stage-actions').getByRole('button',{name:'回到铁砧',exact:true}));expect((await h.read()).state).toEqual(current);
  }
  if(action.type==='deliver'&&before.day===12){expect(current.phase).toBe('workshop');await h.activate(page.locator('#v4-inline-review'));await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07-chapter3/last-lantern-delivered-v1.webp');expect((await h.read()).state).toEqual(current);await h.capture(`${kind}-last-lantern-receipt`);await h.activate(page.locator('#v4-stage-actions').getByRole('button',{name:'回到铁砧',exact:true}));}
 }
 const final=await h.record(`fresh-${kind}-final`);expect(final.state).toEqual(plan.state);expect(partials).toBe(2);expect(oldDay5).toBe(kind==='mixed-return');expect(newDay5).toBe(kind==='two-new');
 expect(v5Sdk.getRunView(final.state).ending?.finalBladeMade).toBe(true);expect(v5Sdk.getRunView(final.state).ending?.missingCritical).toEqual(kind==='two-new'?[]:[4]);
 await expect(page.locator('#v4-stage-title')).toHaveText(kind==='two-new'?'十二灯复明':'灯下归途');expect(final.collection?.challenge).toBe(kind==='two-new');await h.capture(`fresh-${kind}-ending`);
 await h.reload();await h.activate(page.locator('#v4-continue'));const restored=await h.record(`${kind}-ending-reload`);expect(restored.state).toEqual(final.state);expect(restored.collection).toEqual(final.collection);
 await h.finish({scope:'One fresh full UI story, with true partial reloads; no restored-start fixture.',kind,freshUIJourneys:1,partialReloads:partials,ending:final.state.phase,commands:plan.actions.length});
});

test('fresh pure-keyboard failure: three genuine missed days and an unchanged reload',async({page},info)=>{
 const h=new KeyboardV5(page,info);await h.install();await h.start('v5-missed-days');await h.command({type:'continue'});
 for(let day=1;day<=3;day++){await h.command({type:'settle'});if(day<3)await h.command({type:'advance'});}
 const final=await h.record('fresh-keyboard-independent-defeat');expect(final.state.phase).toBe('defeat');expect(final.state.seals).toBe(0);expect(final.state.journal).toHaveLength(6);expect(final.state.history.every(day=>!day.met)).toBe(true);expect(final.collection?.challenge??false).toBe(false);await expect(page.locator('#v4-stage-title')).toHaveText('炉火暂熄');await h.capture('fresh-keyboard-independent-defeat');
 await h.reload();await h.activate(page.locator('#v4-continue'));expect((await h.record('defeat-reload')).state).toEqual(final.state);await h.finish({freshUIJourneys:1,ending:'defeat',commands:6});
});
