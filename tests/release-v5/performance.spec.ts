import {test,expect} from '../e2e/fixtures.js';
import type {RunState} from '../../src/core-v5/index.js';
import {KeyboardV5,v5Envelopes,v5Sdk} from '../e2e/v5-helpers.js';
import {maximumBurstFixture} from './audio-probe.js';
import {createAcceptedObserver,installAcceptedDiagnostics,readAcceptedRaw} from './accepted-observation.js';
import {installT03Runtime,t03Driver,t03Export,t03Idle,t03Pressure,t03Record,t03Stats,t03Step,t03StrikeFixture,t03Workshop,T03_BUDGETS,T03_KEYS,T03_SIZES} from './resilience-probe.js';
import type {T03RuntimeSample} from './resilience-probe.js';

// No screenshots, codec replays, video, Clock or trace overlap the measured animation interval.
test.use({trace:'off',video:'off'});
const paths=['pointer','space','enter'] as const;
type Path=typeof paths[number];
async function nativeInput(h:KeyboardV5,path:Path){
 if(path==='pointer')await h.page.locator('#v4-hit').click();else{await h.page.locator('#v4-strike').focus();await h.page.keyboard.press(path==='space'?'Space':'Enter');}
}
async function restoreTimed(h:KeyboardV5,source:RunState,label:string){
 const envelope=v5Envelopes(source);await h.page.waitForLoadState('networkidle');await h.page.goto('/assets/b/manifest.json');
 await h.page.evaluate(({envelope,keys})=>{for(const key of keys.filter(key=>key!=='sword-led.settings.v1'))localStorage.removeItem(key);localStorage.setItem('sword-led.save.v5',envelope.run);localStorage.setItem('sword-led.collection.v2',envelope.collection);},{envelope,keys:T03_KEYS});
 let navigationToReadyMs:number|null=null;
 try{
  await h.page.goto('/');await expect(h.page.locator('#v4-continue')).toBeEnabled();navigationToReadyMs=await h.page.evaluate(()=>performance.now());await h.assertDpr();
  const projection=await h.page.evaluate(()=>{
   const ready=window.v5AcceptedDiagnostics.continueReady;
   const entry=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
   return{ready,navigation:entry?{responseEnd:entry.responseEnd,domInteractive:entry.domInteractive,domContentLoadedEventEnd:entry.domContentLoadedEventEnd,loadEventEnd:entry.loadEventEnd,duration:entry.duration}:null};
  });
  const pageProjectionReadyMs=projection.ready?.at??null;
  await t03Record(h.info,label+'-load',{phase:'title-ready-before-actual-continue',navigationToReadyMs,observedUpperMs:navigationToReadyMs,pageProjectionReadyMs,projection,observedAfterProjectionMs:pageProjectionReadyMs===null?null:navigationToReadyMs-pageProjectionReadyMs,bytes:Buffer.byteLength(envelope.run),journal:source.journal.length,sourceIdentity:{runId:source.runId,revision:source.revision}});
  expect(pageProjectionReadyMs,'one real page-side Continue readiness observation').not.toBeNull();
  await h.page.locator('#v4-continue').click();await expect(h.page.locator('#v4-workshop')).toBeVisible();
  const continueEvents=await h.page.evaluate(()=>window.v5AcceptedDiagnostics.continueEvents);expect(continueEvents).toHaveLength(1);expect(continueEvents[0]).toMatchObject({trusted:true,workshopVisible:true});expect(continueEvents[0]!.cost).not.toBeNull();
  const load={navigationToReadyMs,observedUpperMs:navigationToReadyMs,pageProjectionReadyMs,projection,observedAfterProjectionMs:pageProjectionReadyMs===null?null:navigationToReadyMs-pageProjectionReadyMs,bytes:Buffer.byteLength(envelope.run),journal:source.journal.length,continueEvents,continueMethod:'Page clock capture→bubble interval of the real Continue click. Product may initialize audio here; consumer does not preview, mute or warm it. Original post-Playwright observed upper bound remains alongside the first page-side visible/enabled projection.'};await t03Record(h.info,label+'-load',load);return load;
 }catch(error){await t03Record(h.info,label+'-load-failure',{error:String(error),navigationToReadyMs,raw:await readAcceptedRaw(h.page),runtime:await h.page.evaluate(()=>({sample:window.t03Runtime.sample(),continueReady:window.v5AcceptedDiagnostics.continueReady}))});throw error;}
}
function actualHandlers(sample:T03RuntimeSample,path:Path){return sample.handlers.filter(row=>row.trusted&&(path==='pointer'?row.type==='pointerdown'&&row.target==='button#v4-hit':path==='space'?row.type==='keyup'&&row.target==='window'&&row.key==='Space':row.type==='keydown'&&row.target==='button#v4-strike'&&row.key==='Enter'));}
function rootHandlers(sample:T03RuntimeSample,path:Path){
 // Reuse the existing observer. Nearest preceding same-type root row is capture onGesture.
 // Space starts root work on down, while its direct commit listener runs on up.
 const type=path==='pointer'?'pointerdown':'keydown',key=path==='pointer'?'':path==='space'?'Space':'Enter',paired=[];
 for(let index=0;index<sample.handlers.length;index++){
  const direct=sample.handlers[index]!;
  if(!direct.trusted||direct.type!==type||direct.key!==key||direct.target!==(path==='pointer'?'button#v4-hit':'button#v4-strike'))continue;
  const capture=sample.handlers.slice(0,index).reverse().find(row=>row.trusted&&row.type===type&&row.key===key&&row.target==='div#app');if(!capture)throw Error('No root capture record preceding the actual forge listener');paired.push(capture);
 }
 return{paired,allRoot:sample.handlers.filter(row=>row.trusted&&row.target==='div#app'&&row.type===type&&row.key===key),method:'Nearest preceding root row paired by native dispatch order; all root rows retained. No second listener wrapper, percentile summation or total browser propagation claim. Space root cost belongs to keydown, direct commit to keyup.'};
}

for(const hz of [60,120,144])test(`v5 controlled${hz}Hz ordinary, safe burst and cancellation preserve exact command counts`,async({page},info)=>{
 test.setTimeout(600000);await installT03Runtime(page);await installAcceptedDiagnostics(page);const h=await t03Driver(page,info),results=[];
 for(const kind of ['ordinary','burst'] as const){
  const fixture=kind==='burst'?maximumBurstFixture(v5Sdk):t03StrikeFixture('ordinary');await h.restoreLegitimate(fixture.before);const observed=createAcceptedObserver(h,fixture.before,{name:`controlled-${hz}-${kind}`});await observed.capture('controlled-restored-boundary');await page.evaluate(hz=>{window.t03Runtime.cadence(hz);window.t03Runtime.reset();},hz);
  try{
   await observed.accept(fixture.action,()=>page.locator('#v4-hit').click());await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');const idle=await t03Idle(page),sample=idle.before;await observed.persist('captured-after-controlled-idle');
   const measured={kind,hz,fixture,sample,idle,intervalMs:t03Stats(sample.frames.slice(1).map((frame,index)=>frame.at-sample.frames[index]!.at))};await t03Record(info,`controlled-${hz}-${kind}-raw`,{...measured,captures:observed.captures});
   const oracle=await observed.verifyAll();expect(observed.state).toEqual(fixture.after);expect(sample.inputs.filter(row=>row.acceptedAt!==null)).toHaveLength(1);expect(sample.contacts).toHaveLength(fixture.strike.hits.length);expect(sample.frames.length).toBeGreaterThan(0);results.push({...measured,oracle});
  }catch(error){await observed.persist('controlled-failed');await t03Record(info,`controlled-${hz}-${kind}-failure`,{error:String(error),actual:await observed.actualSnapshot('controlled-failed')});throw error;}
 }
 const fixture=maximumBurstFixture(v5Sdk);await h.restoreLegitimate(fixture.before);const observed=createAcceptedObserver(h,fixture.before,{name:`controlled-${hz}-cancel`});await observed.capture('cancellation-restored-boundary');await page.evaluate(hz=>{window.t03Runtime.cadence(hz);window.t03Runtime.reset();window.t03Runtime.hold(true);},hz);
 try{
  await observed.accept(fixture.action,()=>page.locator('#v4-hit').click());await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','true');const beforeCancel=await page.evaluate(()=>window.t03Runtime.sample());expect(beforeCancel.pending).toBeGreaterThan(0);await page.keyboard.press('Escape');await expect(page.locator('#v4-dialog')).toBeVisible();const cancelled=await page.evaluate(()=>window.t03Runtime.sample());expect(cancelled.pending).toBe(0);expect(cancelled.cancelled).toBeGreaterThan(0);await page.evaluate(()=>window.t03Runtime.hold(false));await page.getByRole('button',{name:'继续锻造',exact:true}).click();const idle=await t03Idle(page);await observed.capture('cancelled-atomic-result-preserved');await observed.persist('controlled-cancel-idle');
  await t03Record(info,`controlled-${hz}-cancel-raw`,{beforeCancel,cancelled,idle,captures:observed.captures});const oracle=await observed.verifyAll();expect(observed.state).toEqual(fixture.after);
  await t03Record(info,`controlled-${hz}`,{scope:'Test-only timer RAF cadence; real native animations and legal atomic commands. Counts and full domain/RNG equality are observed; not physicalHz, real paint or GPU evidence.',hz,results,cancellation:{beforeCancel,cancelled,idle,expected:fixture.after,oracle}});await h.finish();
 }catch(error){await observed.persist('controlled-cancel-failed');await t03Record(info,`controlled-${hz}-cancel-failure`,{error:String(error),actual:await observed.actualSnapshot('controlled-cancel-failed')});throw error;}
});

for(const size of T03_SIZES)for(const kind of ['short','natural-long','pressure-long'] as const)test(`v5 native callback and trusted handlers ${kind} at${size.width}`,async({page},info)=>{
 test.setTimeout(600000);await page.setViewportSize(size);await installT03Runtime(page);await installAcceptedDiagnostics(page);const h=await t03Driver(page,info);
 let source=kind==='short'?t03Workshop():kind==='natural-long'?t03Workshop(12):t03Pressure(1890);if(source.reserveId)source=t03Step(source,{type:'reserve',pieceId:source.reserveId}).state;
 const perPath=[];let final=source;
 for(const path of paths){
  const label=`native-${kind}-${size.width}-${path}`,load=await restoreTimed(h,source,label),observed=createAcceptedObserver(h,source,{name:label});await observed.capture('explicit-timed-restored-boundary');await page.waitForLoadState('networkidle');await page.evaluate(()=>window.t03Runtime.reset());
  try{
   const blades=source.blades.filter(blade=>blade.status==='active'&&blade.id!==source.reserveId&&blade.suppliedDay===source.day&&blade.hits===0).slice(0,2);expect(blades).toHaveLength(2);
   for(const blade of blades)for(let hit=0;hit<3;hit++){await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await h.select(blade.id);await observed.accept({type:'strike',pieceId:blade.id},()=>nativeInput(h,path));await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');}
   const idle=await t03Idle(page),sample=idle.before,handlers=actualHandlers(sample,path),root=rootHandlers(sample,path),inputs=sample.inputs.filter(row=>row.acceptedAt!==null),callback=t03Stats(sample.frames.map(frame=>frame.cost)),handler=t03Stats(handlers.map(row=>row.cost)),rootHandler=t03Stats(root.paired.map(row=>row.cost));
   const response=inputs.map(row=>({kind:row.kind,inputToAcceptedMs:row.acceptedAt!-row.at,firstContactMs:row.contactAt===null?null:row.contactAt-row.at,busyMs:row.idleAt===null?null:row.idleAt-row.at})),measured={path,load,callback,handler,rootHandler,root,response,sample,idle,callbackInvestigationRequired:(callback.max??0)>=T03_BUDGETS.callbackInvestigateMaxMs};await observed.persist('native-page-measurement-complete');
   await t03Record(info,label,{scope:'Native RAF and trusted listener wall time. Direct and root capture work are retained; Continue cold cost is a separate actual product click. Primary raw snapshots are formally decoded once after idle. Not GPU/compositor/full propagation/physical display certification.',budgets:T03_BUDGETS,source,measured,captures:observed.captures,environment:{browser:page.context().browser()?.version(),node:process.version,platform:process.platform,arch:process.arch}});
   const oracle=await observed.verifyAll();final=observed.state;perPath.push({...measured,oracle});expect(handlers).toHaveLength(6);expect(root.paired).toHaveLength(6);expect(inputs).toHaveLength(6);expect(sample.frames.length).toBeGreaterThanOrEqual(60);expect(inputs.every(row=>row.trusted)).toBe(true);
   expect.soft(load.navigationToReadyMs,'restore→visible enabled Continue (original observed upper bound)').toBeLessThanOrEqual(T03_BUDGETS.loadMs);
   expect.soft(load.pageProjectionReadyMs,'page-side first visible/enabled Continue projection').not.toBeNull();if(load.pageProjectionReadyMs!==null)expect.soft(load.pageProjectionReadyMs,'page-side first visible/enabled Continue projection').toBeLessThanOrEqual(T03_BUDGETS.loadMs);
   expect.soft(callback.p95,'native RAF JS p95').toBeLessThan(T03_BUDGETS.callbackP95Ms);expect.soft(callback.max,'max≥50ms requires investigation').toBeLessThan(T03_BUDGETS.callbackInvestigateMaxMs);
   const p95=kind==='short'?T03_BUDGETS.shortHandlerP95Ms:T03_BUDGETS.longHandlerP95Ms,max=kind==='short'?T03_BUDGETS.shortHandlerMaxMs:T03_BUDGETS.longHandlerMaxMs;
   expect.soft(handler.p95,'actual direct handler p95').toBeLessThan(p95);expect.soft(handler.max,'actual direct handler max').toBeLessThan(max);expect.soft(rootHandler.p95,'actual root capture handler p95').toBeLessThan(p95);expect.soft(rootHandler.max,'actual root capture handler max').toBeLessThan(max);
   for(const row of response){expect.soft(row.inputToAcceptedMs,'trusted input→Accepted').toBeLessThanOrEqual(T03_BUDGETS.inputToAcceptedMs);expect.soft(row.firstContactMs,'ordinary contact observed').not.toBeNull();if(row.firstContactMs!==null)expect.soft(row.firstContactMs,'normal first contact').toBeLessThanOrEqual(T03_BUDGETS.firstContactMs);}
  }catch(error){await observed.persist('native-path-failed');await t03Record(info,label+'-failure',{error:String(error),actual:await observed.actualSnapshot('native-path-failed')});throw error;}
 }
 expect(await t03Export(page)).toEqual(final);await page.screenshot({path:info.outputPath(`native-${kind}-${size.width}-post-measurement.png`)});await t03Record(info,`native-${kind}-${size.width}-summary`,{source,perPath,final,measurementNotes:'Each actual path keeps its first input and six Accepted commands. All animation/idle and raw capture finish before formal codec replays, exports, screenshots or attachments. Oracle timing never replaces page budgets. Screenshot uses this independently declared target size.'});await h.finish();
});

for(const size of T03_SIZES)test(`v5 native four-hit maximum safe burst callback budget at${size.width}`,async({page},info)=>{
 test.setTimeout(600000);await page.setViewportSize(size);await installT03Runtime(page);await installAcceptedDiagnostics(page);const h=await t03Driver(page,info),fixture=maximumBurstFixture(v5Sdk);expect(fixture.strike.hits).toHaveLength(4);
 const label=`native-four-hit-${size.width}`,samples=[];
 // Exactly three independent legal recoveries are decided before observing their costs.
 // A single four-hit animation may naturally contain fewer than60 application callbacks.
 for(const sampleIndex of [1,2,3]){
  const sampleLabel=`${label}-sample-${sampleIndex}`,load=await restoreTimed(h,fixture.before,sampleLabel),observed=createAcceptedObserver(h,fixture.before,{name:sampleLabel});await observed.capture('four-hit-restored-boundary');await page.waitForLoadState('networkidle');await h.select(fixture.action.pieceId);await page.evaluate(()=>window.t03Runtime.reset());
  try{
   await observed.accept(fixture.action,()=>page.locator('#v4-hit').click());await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');const idle=await t03Idle(page),sample=idle.before,callback=t03Stats(sample.frames.map(frame=>frame.cost)),root=rootHandlers(sample,'pointer'),rootHandler=t03Stats(root.paired.map(row=>row.cost)),direct=actualHandlers(sample,'pointer'),directHandler=t03Stats(direct.map(row=>row.cost));
   const inputs=sample.inputs.filter(row=>row.acceptedAt!==null),response=inputs.map(row=>({kind:row.kind,inputToAcceptedMs:row.acceptedAt!-row.at,firstContactMs:row.contactAt===null?null:row.contactAt-row.at,busyMs:row.idleAt===null?null:row.idleAt-row.at}));await observed.persist('four-hit-page-idle');
   await t03Record(info,sampleLabel,{scope:'One independent legal restored maximum-burst boundary and one actual four-hit Accepted. Fixed sample1/2/3, including the first cold continuation/input. Real application RAF only; no no-op RAF, timer cadence, trace, geometry sampler or animation extension. Ordinary first-contact200ms is not silently applied as a new burst gate; actual burst response is fully retained.',sampleIndex,fixture,load,callback,root,rootHandler,directHandler,response,sample,idle,captures:observed.captures,budgets:T03_BUDGETS});
   const oracle=await observed.verifyAll();expect(observed.state).toEqual(fixture.after);expect(sample.contacts).toHaveLength(4);expect(inputs).toHaveLength(1);expect(inputs[0]!.trusted).toBe(true);expect(root.paired).toHaveLength(1);expect(direct).toHaveLength(1);
   samples.push({sampleIndex,load,callback,rootHandler,directHandler,response,sample,idle,oracle,actualState:observed.state});await t03Record(info,label+'-partial',{scope:'Fixed three-sample group in progress; prior original one-burst45/35 insufficient-sample reds remain separate and unchanged.',fixture,completedIndependentSamples:samples.length,samples});
   // Costs remain bounded for EACH sample; aggregation never conceals a slow member.
   expect.soft(callback.p95,'each actual four-hit callback JS p95').toBeLessThan(T03_BUDGETS.callbackP95Ms);expect.soft(callback.max,'each four-hit max≥50ms requires investigation').toBeLessThan(T03_BUDGETS.callbackInvestigateMaxMs);expect.soft(rootHandler.p95,'each burst root capture p95').toBeLessThan(T03_BUDGETS.longHandlerP95Ms);expect.soft(rootHandler.max,'each burst root capture max').toBeLessThan(T03_BUDGETS.longHandlerMaxMs);expect.soft(directHandler.p95,'each burst direct handler p95').toBeLessThan(T03_BUDGETS.longHandlerP95Ms);expect.soft(directHandler.max,'each burst direct handler max').toBeLessThan(T03_BUDGETS.longHandlerMaxMs);
  }catch(error){await observed.persist('four-hit-failed');await t03Record(info,sampleLabel+'-failure',{sampleIndex,error:String(error),actual:await observed.actualSnapshot('four-hit-failed'),completedIndependentSamples:samples.length});throw error;}
 }
 const actualFrames=samples.flatMap(row=>row.sample.frames),callback=t03Stats(actualFrames.map(frame=>frame.cost));await t03Record(info,label,{scope:'Exactly three independent legal restore→one four-hit Accepted→idle→formal-codec samples. The group contains three accepted commands and twelve contacts, not one animation or three complete campaigns. Aggregate samples are exclusively the real application callbacks already preserved per member; no physicalHz/GPU claim. Original45/35-case failures remain archived.',fixture,independentSamples:samples.length,acceptedCommands:samples.length,contacts:samples.reduce((sum,row)=>sum+row.sample.contacts.length,0),callback,samples,budgets:T03_BUDGETS,burstResponseScope:'Actual per-sample input/contact timings remain recorded, including any205ms observation. The existing ordinary200ms response gate is unchanged in the ordinary cases, not retroactively imposed or removed here.'});
 expect(samples).toHaveLength(3);expect(samples.reduce((sum,row)=>sum+row.sample.contacts.length,0)).toBe(12);expect(actualFrames.length).toBeGreaterThanOrEqual(60);expect(callback.p95).toBeLessThan(T03_BUDGETS.callbackP95Ms);expect(callback.max).toBeLessThan(T03_BUDGETS.callbackInvestigateMaxMs);await h.finish({independentMaximumBurstSamples:3,scope:'Fixed three legal recovered maximum-burst measurements, each1Accepted/4contacts with per-raw shipping codec verification after idle; not fresh complete games or one composite atomic command.'});
});
