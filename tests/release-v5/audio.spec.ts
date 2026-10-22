import {test,expect} from '../e2e/fixtures.js';
import type {Page,TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {Action,DomainEvent,RunState} from '../../src/core-v5/index.js';
import {KeyboardV5,keyToV5,v5Sdk,v5VictoryGuide} from '../e2e/v5-helpers.js';
import {acceptedByV5,lastStrikeV5} from '../e2e/v5-interaction-helpers.js';
import {installReleaseAudioProbe,releaseAudioSnapshot,resetReleaseAudioCapture,releaseDeferredAudio,setReleaseAudioFaults,maximumBurstFixture} from './audio-probe.js';
import type {AudioFaults,ReleaseAudioSnapshot} from './audio-probe.js';

type Strike=Extract<DomainEvent,{type:'Strike'}>;
type StrikeKind='success'|'great'|'crack'|'broken'|'safeBurst';
interface StrikeFixture {before:RunState;action:Extract<Action,{type:'strike'|'deliver'|'scrap'|'reserve'}>;after:RunState;strike:Strike;witnessPrefix:number}
const gameKeys=['sword-led.save.v5','sword-led.save.backup.v5','sword-led.collection.v2','sword-led.collection.backup.v2'] as const;
const impactTones=(strike:Strike)=>strike.hits.flatMap(hit=>hit.result==='great'?[89,631,1723]:hit.result==='crack'?[197,1499,3167]:hit.result==='broken'?[173,467,2279]:[139,947,2381]);

/** Search only the already published finite witness. No random state/resources/phase are assigned. */
function strikeFixture(kind:StrikeKind):StrikeFixture{
 const made=v5Sdk.createRun({runId:'v5-release-audio-boundary',seed:'v5-economy-0'});if(!made.ok)throw Error(made.error);let before=made.state;
 for(const [index,action] of v5VictoryGuide.entries()){
  const result=v5Sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!result.ok)throw Error('Published audio witness rejected: '+result.error);
  const strike=result.events.find(event=>event.type==='Strike');
  if(action.type==='strike'&&strike?.type==='Strike'&&(kind==='safeBurst'?strike.burst&&strike.hits.length>=2:!strike.burst&&strike.hits[0]?.result===kind)){
   const checked=v5Sdk.validateRun(before);if(!checked.ok)throw Error(checked.detail);return{before:checked.state,action,after:result.state,strike,witnessPrefix:index};
  }
  before=result.state;
 }
 throw Error(`Published guide has no ${kind} boundary; do not inject an outcome to make this pass.`);
}
async function slots(page:Page){return page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),gameKeys);}
async function quiet(page:Page){await expect.poll(async()=>(await releaseAudioSnapshot(page)).active).toBe(0);}
async function suspended(page:Page){await expect.poll(async()=>(await releaseAudioSnapshot(page)).states.some(state=>state==='running')).toBe(false);}
async function audioState(page:Page,state:string){await expect(page.locator('#v4-audio-status')).toHaveAttribute('data-state',state);}
async function settings(h:KeyboardV5){await h.activate(h.page.locator(await h.page.locator('#v4-title').isVisible()?'#v4-title-settings':'#v4-settings'));await expect(h.page.locator('#v4-dialog-title')).toHaveText('声音与动效');}
async function closeSettings(h:KeyboardV5){await h.activate(h.page.getByRole('button',{name:'收好',exact:true}));await expect(h.page.locator('#v4-dialog')).not.toBeVisible();}
async function preview(h:KeyboardV5){await settings(h);await h.activate(h.page.getByRole('button',{name:'试听敲击声',exact:true}));await audioState(h.page,'ready');}
async function prepared(page:Page,info:TestInfo,faults:AudioFaults={},fixture?:StrikeFixture){
 await installReleaseAudioProbe(page,faults);const h=new KeyboardV5(page,info,'mouse');await h.install();
 if(fixture)await h.restoreLegitimate(fixture.before);else{await h.start();await h.command({type:'continue'});}
 return h;
}
function outputGraph(snapshot:ReleaseAudioSnapshot){
 expect(snapshot.contexts).toBeGreaterThan(0);expect(snapshot.states).toHaveLength(snapshot.contexts);expect(snapshot.contextClocks).toHaveLength(snapshot.contexts);
 expect(snapshot.states.filter(state=>state!=='closed').length).toBeLessThanOrEqual(1);
 const nodes=new Map(snapshot.nodes.map(node=>[node.id,node]));expect(nodes.size).toBe(snapshot.nodes.length);
 for(const node of snapshot.nodes){expect(Number.isInteger(node.context)).toBe(true);expect(node.context).toBeGreaterThan(0);expect(node.context).toBeLessThanOrEqual(snapshot.contexts);}
 for(const edge of snapshot.edges){const from=nodes.get(edge.from),to=nodes.get(edge.to);expect(from).toBeDefined();expect(to).toBeDefined();expect(from!.context).toBe(to!.context);}
 expect(new Set(snapshot.sources.map(source=>source.id)).size).toBe(snapshot.sources.length);expect(snapshot.sources).toHaveLength(snapshot.starts);
 for(let context=1;context<=snapshot.contexts;context++){
  const clock=snapshot.contextClocks.find(value=>value.context===context);expect(clock).toBeDefined();expect(clock!.state).toBe(snapshot.states[context-1]);
  if(context<snapshot.contexts)expect(snapshot.states[context-1]).toBe('closed');
  const graph=snapshot.nodes.filter(node=>node.context===context),masters=graph.filter(node=>node.kind==='master'),destinations=graph.filter(node=>node.kind==='destination'),analysers=graph.filter(node=>node.kind==='post-master-analyser');
  expect(masters).toHaveLength(1);expect(destinations).toHaveLength(1);expect(analysers).toHaveLength(1);const master=masters[0]!,destination=destinations[0]!,analyser=analysers[0]!;
  const outputs=snapshot.edges.filter(edge=>edge.from===master.id);expect(outputs).toHaveLength(2);expect(outputs.map(edge=>edge.to).sort((a,b)=>a-b)).toEqual([destination.id,analyser.id].sort((a,b)=>a-b));
  const sources=snapshot.sources.filter(source=>source.context===context);
  if(snapshot.states[context-1]==='closed')expect(sources.every(source=>source.disconnected)).toBe(true);
  for(const source of sources){
   const oscillator=nodes.get(source.id);expect(oscillator).toMatchObject({id:source.id,kind:'oscillator',context});
   const connections=snapshot.edges.filter(edge=>edge.from===source.id);expect(connections).toHaveLength(1);const envelope=nodes.get(connections[0]!.to);expect(envelope).toMatchObject({kind:'envelope',context});
   const envelopes=snapshot.edges.filter(edge=>edge.from===envelope!.id);expect(envelopes).toHaveLength(1);expect(envelopes[0]!.to).toBe(master.id);
   expect(source.path).toEqual({oscillator:source.id,envelope:envelope!.id,master:master.id,analyser:analyser.id,destination:destination.id});
  }
 }
 for(const source of snapshot.sources)expect(nodes.get(source.id)?.context).toBe(source.context);
 expect(snapshot.maxActive).toBeLessThanOrEqual(12);
}
async function record(info:TestInfo,label:string,details:Record<string,unknown>){await writeFile(info.outputPath(`audio-${label}.json`),JSON.stringify({label,project:info.project.name,scope:'Native AudioContext graph, post-master waveform and trusted UI inputs. Named platform faults are test-only. No physical speaker/listening/OS-volume approval.',...details},null,2));}
async function diagnostic(page:Page){
 const [audio,raw,view]=await Promise.all([
  releaseAudioSnapshot(page).catch(error=>({error:String(error)})),
  slots(page).catch(error=>({error:String(error)})),
  page.evaluate(()=>{
   const attributes=(selector:string)=>{const node=document.querySelector(selector);return node?Object.fromEntries([...node.attributes].map(attribute=>[attribute.name,attribute.value])):null;};
   return{url:location.href,hidden:document.hidden,visibilityState:document.visibilityState,dialog:{attributes:attributes('#v4-dialog'),title:document.querySelector('#v4-dialog-title')?.textContent??null},audioStatus:{attributes:attributes('#v4-audio-status'),text:document.querySelector('#v4-audio-status')?.textContent??null},scene:attributes('#v4-scene'),hammer:attributes('#v4-hammer'),stage:attributes('#v4-stage'),title:attributes('#v4-title'),focus:document.activeElement?{id:document.activeElement.id,tag:document.activeElement.tagName}:null};
  }).catch(error=>({error:String(error)})),
 ]);
 return{audio,raw,view};
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)await record(info,'failed-final-observation',{status:info.status,expectedStatus:info.expectedStatus,observation:await diagnostic(page)});});
async function readyWithoutPreview(h:KeyboardV5){
 // A real UI gesture resumes game audio, but this non-economic control never fabricates an impact.
 await h.activate(h.page.locator('#v4-inventory button').first());
 await expect.poll(async()=>(await releaseAudioSnapshot(h.page)).states).toEqual(['running']);
}
async function strikeNow(h:KeyboardV5,action:Action={type:'strike',pieceId:'d1-1'}){await h.command(action);return lastStrikeV5(h);}

test('v5 release cold title/settings are silent until explicit preview creates a real output graph and waveform',async({page},info)=>{
 await installReleaseAudioProbe(page);const h=new KeyboardV5(page,info,'mouse');await h.install();await page.goto('/');await expect(page.locator('#v4-start')).toBeEnabled();await h.assertDpr();const before=await slots(page);
 expect((await releaseAudioSnapshot(page)).constructors).toBe(0);await settings(h);await audioState(page,'waiting');expect((await releaseAudioSnapshot(page)).constructors).toBe(0);
 await h.activate(page.getByRole('button',{name:'试听敲击声',exact:true}));await audioState(page,'ready');await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);
 const sounding=await releaseAudioSnapshot(page);expect(sounding.starts).toBe(3);expect(sounding.frequencies).toEqual([139,947,2381]);outputGraph(sounding);await closeSettings(h);await quiet(page);await suspended(page);expect(await slots(page)).toEqual(before);
 await record(info,'cold-preview',{before,sounding,after:await releaseAudioSnapshot(page)});await page.screenshot({path:info.outputPath('audio-title-after-preview.png')});await h.finish({gameplayCommands:0});
});

test('v5 release first actual gameplay gesture makes one accepted impact audible with trusted contact identity',async({page},info)=>{
 const h=await prepared(page,info);expect((await releaseAudioSnapshot(page)).starts).toBe(0);await resetReleaseAudioCapture(page);const before=await releaseAudioSnapshot(page);const strike=await strikeNow(h);
 await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);const after=await releaseAudioSnapshot(page);expect(after.starts-before.starts).toBe(3);expect(after.frequencies.slice(before.frequencies.length)).toEqual(impactTones(strike));expect(after.inputs.some(input=>input.trusted&&input.type==='pointerdown')).toBe(true);expect(after.contacts.map(contact=>contact.outcome)).toEqual(strike.hits.map(hit=>hit.result));outputGraph(after);
 const first=after.sources[before.starts]!,input=after.inputs.find(input=>input.type==='pointerdown')!;expect(first.at).toBeGreaterThanOrEqual(input.at);expect(Math.abs(first.at-after.contacts[0]!.at)).toBeLessThan(100);
 await quiet(page);expect((await releaseAudioSnapshot(page)).sources.every(source=>source.disconnected)).toBe(true);await record(info,'first-game-impact',{strike,before,after});await h.finish();
});

for(const kind of ['success','great','crack','broken','safeBurst'] as const)test(`v5 release ${kind} tones belong to the actual legal accepted strike`,async({page},info)=>{
 const fixture=strikeFixture(kind),h=await prepared(page,info,{},fixture);await readyWithoutPreview(h);await quiet(page);await resetReleaseAudioCapture(page);const before=await releaseAudioSnapshot(page),strike=await strikeNow(h,fixture.action);expect(strike).toEqual(fixture.strike);expect((await h.read()).state).toEqual(fixture.after);
 const tones=impactTones(strike);await expect.poll(async()=>(await releaseAudioSnapshot(page)).starts).toBe(before.starts+tones.length);await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);const after=await releaseAudioSnapshot(page);expect(after.frequencies.slice(before.frequencies.length)).toEqual(tones);expect(after.contacts.map(contact=>contact.outcome)).toEqual(strike.hits.map(hit=>hit.result));outputGraph(after);
 if(kind==='safeBurst'){expect(strike.burst).toBe(true);expect(strike.hits.every(hit=>hit.result==='success'||hit.result==='great')).toBe(true);expect(fixture.after.revision).toBe(fixture.before.revision+1);}
 await quiet(page);await record(info,'identity-'+kind,{fixture,before,after,scope:'Explicit formal-witness recovery boundary and one real UI strike; not a new complete campaign.'});await h.finish();
});

test('v5 release earned Ember and Wide Mouth produce exactly four safe-hit cues from one accepted command',async({page},info)=>{
 const fixture=maximumBurstFixture(v5Sdk),h=await prepared(page,info,{},fixture);await readyWithoutPreview(h);await h.select(fixture.action.pieceId);await resetReleaseAudioCapture(page);const before=await releaseAudioSnapshot(page),strike=await strikeNow(h,fixture.action);expect(strike).toEqual(fixture.strike);expect(strike.hits).toHaveLength(4);expect(strike.hits.every(hit=>hit.triggers.includes('ember')&&hit.triggers.includes('wideMouth'))).toBe(true);expect((await h.read()).state).toEqual(fixture.after);
 await expect.poll(async()=>(await releaseAudioSnapshot(page)).starts).toBe(before.starts+12);const after=await releaseAudioSnapshot(page);expect(after.frequencies.slice(before.frequencies.length)).toEqual(impactTones(strike));expect(after.contacts.map(contact=>contact.outcome)).toEqual(strike.hits.map(hit=>hit.result));expect(after.capturedPeak).toBeGreaterThan(.001);outputGraph(after);await quiet(page);await record(info,'earned-max-four',{fixture,before,after,scope:'One fixed-seed finite public-command recovery witness, earning Ember and Wide Mouth through legal actions; one actual UI four-hit Accepted. Not a full UI campaign or seed simulation.'});await h.finish();
});

for(const kind of ['mute','zero'] as const)test(`v5 release persisted ${kind} silences accepted work across reload and resumes only on fresh input`,async({page},info)=>{
 const h=await prepared(page,info);await preview(h);await closeSettings(h);await quiet(page);const before=await slots(page);await settings(h);
 if(kind==='mute')await page.getByLabel('静音',{exact:true}).check();else{await keyToV5(page,page.getByLabel('敲击音量',{exact:true}));await page.keyboard.press('Home');}
 await audioState(page,'muted');await quiet(page);await suspended(page);expect(await slots(page)).toEqual(before);const settingsRaw=await page.evaluate(()=>localStorage.getItem('sword-led.settings.v1'));expect(settingsRaw).not.toBeNull();await closeSettings(h);await h.reload();expect((await releaseAudioSnapshot(page)).constructors).toBe(0);await h.activate(page.locator('#v4-continue'));
 const mutedBefore=await releaseAudioSnapshot(page);const first=await strikeNow(h);expect((await releaseAudioSnapshot(page)).starts).toBe(mutedBefore.starts);await quiet(page);await settings(h);await audioState(page,'muted');
 if(kind==='mute'){await expect(page.getByLabel('静音',{exact:true})).toBeChecked();await page.getByLabel('静音',{exact:true}).uncheck();}else{await expect(page.getByLabel('敲击音量',{exact:true})).toHaveValue('0');await keyToV5(page,page.getByLabel('敲击音量',{exact:true}));await page.keyboard.press('End');}
 await closeSettings(h);const silent=await releaseAudioSnapshot(page);expect(silent.starts).toBe(0);await resetReleaseAudioCapture(page);const second=await strikeNow(h);await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);expect((await releaseAudioSnapshot(page)).starts).toBe(impactTones(second).length);
 await record(info,'persisted-'+kind,{settingsRaw,first,second,probe:await releaseAudioSnapshot(page)});await h.finish();
});

for(const failure of ['blocked','unavailable'] as const)test(`v5 release ${failure} native audio remains readable, does not revoke accepted progress and retries through UI`,async({page},info)=>{
 const h=await prepared(page,info,failure==='blocked'?{rejectResume:true}:{deny:true});const strike=await strikeNow(h),accepted=(await h.read()).state;await settings(h);await audioState(page,failure);await expect(page.locator('#v4-audio-status')).toContainText('锻造仍可继续');const retry=page.getByRole('button',{name:'试听敲击声',exact:true});await expect(retry).toBeEnabled();await h.activate(retry);await audioState(page,failure);const denied=await releaseAudioSnapshot(page);expect(denied.starts).toBe(0);expect(denied.active).toBe(0);expect(denied.contexts).toBe(failure==='blocked'?1:0);expect((await h.read()).state).toEqual(accepted);
 await setReleaseAudioFaults(page,{deny:false,rejectResume:false});await h.activate(retry);await audioState(page,'ready');await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);const retried=await releaseAudioSnapshot(page);expect(retried.starts).toBe(3);outputGraph(retried);expect((await h.read()).state).toEqual(accepted);await closeSettings(h);await quiet(page);await h.command({type:'deliver',pieceId:'d1-1'});expect((await h.read()).state.coins).toBeGreaterThan(accepted.coins);
 await record(info,'fault-'+failure,{fault:failure==='blocked'?'Native context suspended at creation; resume promise rejected until explicit test fault release':'Native AudioContext constructor rejected until explicit test fault release',strike,denied,retried});await h.finish();
});

for(const destination of ['pause','title','new-run'] as const)test(`v5 release late native resume cannot replay an old accepted impact after ${destination}`,async({page},info)=>{
 const fixture=strikeFixture('success'),h=await prepared(page,info,{defer:true},fixture),titleStages:Record<string,unknown>[]=[];let titlePhase='before-old-strike';
 const titleCheckpoint=(phase:string)=>{if(destination==='title'){titlePhase=phase;titleStages.push({phase});}};
 try{
  await strikeNow(h,fixture.action);await expect.poll(async()=>(await releaseAudioSnapshot(page)).deferred).toBe(true);const accepted=await h.read(),originalActivation=await releaseAudioSnapshot(page);expect(originalActivation.starts).toBe(0);await h.activate(page.locator('#v4-menu'));
  if(destination!=='pause'){await h.activate(page.getByRole('button',{name:'回标题',exact:true}));if(destination==='new-run'){await h.activate(page.locator('#v4-start'));await h.confirm();}}
  const current=await h.record('before-release-after-'+destination);if(destination==='new-run'){expect(current.state.runId).not.toBe(accepted.state.runId);expect(current.state).toMatchObject({phase:'opening',revision:0,coins:0,journal:[]});}else expect(current.state).toEqual(accepted.state);
  let newerActivation:ReleaseAudioSnapshot|null=null;
  if(destination==='new-run'){await expect.poll(async()=>(await releaseAudioSnapshot(page)).states).toEqual(['running']);newerActivation=await releaseAudioSnapshot(page);expect(newerActivation.resumeCalls).toBeGreaterThan(originalActivation.resumeCalls);expect(newerActivation.starts).toBe(0);expect(newerActivation.active).toBe(0);}
  await releaseDeferredAudio(page);if(destination==='new-run')await expect.poll(async()=>(await releaseAudioSnapshot(page)).states).toEqual(['running']);else await suspended(page);await quiet(page);const stale=await releaseAudioSnapshot(page);expect(stale.starts).toBe(0);expect((await h.read()).raw).toEqual(current.raw);
  if(destination==='title')titleCheckpoint('precontinue');
  if(destination==='pause')await h.activate(page.getByRole('button',{name:'继续锻造',exact:true}));else if(destination==='title')await h.activate(page.locator('#v4-continue'));else await h.command({type:'continue'});
  if(destination==='title')titleCheckpoint('postcontinue');
  const pieceId=destination==='new-run'?'d1-1':fixture.action.pieceId;await resetReleaseAudioCapture(page);if(destination==='title')titleCheckpoint('prefresh');const fresh=await strikeNow(h,{type:'strike',pieceId});if(destination==='title')titleCheckpoint('postfresh');await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);expect((await releaseAudioSnapshot(page)).starts).toBe(impactTones(fresh).length);await record(info,'late-'+destination,{fault:'Native resume is invoked in the original gesture; only its original completion is held and release issues no native API. Constructor suspension remains an explicit test fault',fixture,accepted,current,originalActivation,newerActivation,stale,fresh,after:await releaseAudioSnapshot(page),authority:destination==='new-run'?'Actual confirmed new-run gesture acquired a newer native activation before older resume release; old cue stays absent and its completion cannot revoke the newer activation':'No newer continue/start gesture before older resume release; native context must remain suspended'});await h.finish();
 }finally{
  if(destination==='title')await record(info,'late-title-stages',{phase:titlePhase,stages:titleStages,final:await diagnostic(page),scope:'Phase labels have no browser calls between real Continue and fresh strike; only final/failed observation reads native diagnostics. Actual native button/lifecycle traces and strict waveform assertions remain.'});
 }
});

test('v5 release closing a pending preview cancels it without creating game progress or delayed sound',async({page},info)=>{
 await installReleaseAudioProbe(page,{defer:true});const h=new KeyboardV5(page,info,'mouse');await h.install();await page.goto('/');await expect(page.locator('#v4-start')).toBeEnabled();const before=await slots(page);await settings(h);await h.activate(page.getByRole('button',{name:'试听敲击声',exact:true}));await expect.poll(async()=>(await releaseAudioSnapshot(page)).deferred).toBe(true);await closeSettings(h);await releaseDeferredAudio(page);await suspended(page);await quiet(page);const cancelled=await releaseAudioSnapshot(page);expect(cancelled.starts).toBe(0);expect(await slots(page)).toEqual(before);
 await preview(h);await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);expect((await releaseAudioSnapshot(page)).starts).toBe(3);await closeSettings(h);await quiet(page);expect(await slots(page)).toEqual(before);await record(info,'cancel-preview-close',{before,cancelled,after:await releaseAudioSnapshot(page)});await h.finish({gameplayCommands:0});
});

for(const cancellation of ['mute','zero','system-motion'] as const)test(`v5 release ${cancellation} invalidates pending preview without changing accepted progress`,async({page},info)=>{
 const fixture=strikeFixture('success'),h=await prepared(page,info,{},fixture),before=await slots(page);await settings(h);await suspended(page);await setReleaseAudioFaults(page,{defer:true});await h.activate(page.getByRole('button',{name:'试听敲击声',exact:true}));await expect.poll(async()=>(await releaseAudioSnapshot(page)).deferred).toBe(true);
 if(cancellation==='mute')await page.getByLabel('静音',{exact:true}).check();else if(cancellation==='zero'){await page.getByLabel('敲击音量',{exact:true}).click();await page.keyboard.press('Home');}else{await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#v4-scene')).toHaveAttribute('data-reduced','true');await expect(page.locator('#v4-preference-status')).toContainText('系统减弱动效已启用');}
 await releaseDeferredAudio(page);await suspended(page);await quiet(page);expect((await releaseAudioSnapshot(page)).starts).toBe(0);expect(await slots(page)).toEqual(before);await record(info,'cancel-preview-'+cancellation,{before,after:await releaseAudioSnapshot(page),faultOwner:'Fault-free restore and settings entry; defer enabled only after native suspension, so the held resume belongs to this one explicit preview',scope:cancellation==='system-motion'?'Browser-emulated prefers-reduced-motion media change; physical OS preference not changed':'Actual persisted settings UI; only native resume completion is held'});await closeSettings(h);await h.finish();
});

test('v5 release repeated native previews cap concurrent sources and stop on settings close without economic writes',async({page},info)=>{
 const h=await prepared(page,info),before=await slots(page);await preview(h);for(let i=0;i<12;i++)await h.activate(page.getByRole('button',{name:'试听敲击声',exact:true}));const loaded=await releaseAudioSnapshot(page);expect(loaded.starts).toBe(39);outputGraph(loaded);await closeSettings(h);await quiet(page);expect((await releaseAudioSnapshot(page)).sources.every(source=>source.disconnected)).toBe(true);expect(await slots(page)).toEqual(before);await record(info,'preview-cap',{before,loaded,after:await releaseAudioSnapshot(page)});await h.finish();
});

test('v5 release twenty real sounding settings-close-pause-resume cycles stop every voice and stay silent through two idle windows',async({page},info)=>{
 const h=await prepared(page,info),before=await slots(page),initial=await releaseAudioSnapshot(page),cycles:Record<string,unknown>[]=[];
 let cycleAtFailure=0,phase='before-loop',explicitStopSources=0,naturalEndSources=0,explicitStopCycles=0,naturalEndCycles=0;
 try{
  expect(initial.starts).toBe(0);
  for(let cycle=1;cycle<=20;cycle++){
   cycleAtFailure=cycle;phase='before-preview';
   const previous=await releaseAudioSnapshot(page);await preview(h);phase='after-preview-ready';
   const observed:{sounding?:ReleaseAudioSnapshot}={};
   await expect.poll(async()=>{const sample=await releaseAudioSnapshot(page);if(sample.active>0)observed.sounding=sample;return sample.active;}).toBeGreaterThan(0);
   const sounding=observed.sounding;if(!sounding)throw Error('Missing the successful actual active-source observation');expect(sounding.starts).toBe(previous.starts+3);expect(sounding.active).toBeGreaterThan(0);outputGraph(sounding);
   phase='closing-settings';await closeSettings(h);await quiet(page);const closed=await releaseAudioSnapshot(page),sources=closed.sources.slice(previous.sources.length);
   const previewClickSequence=sounding.buttonClicks.at(-1)?.sequence??0,closeClicks=closed.buttonClicks.filter(click=>click.sequence>previewClickSequence&&click.label==='收好');expect(closeClicks).toHaveLength(1);const closeClick=closeClicks[0]!;
   expect(closeClick.trusted).toBe(true);expect(closeClick.starts).toBe(sounding.starts);expect(sources).toHaveLength(3);expect(closeClick.activeSourceIds.every(id=>sources.some(source=>source.id===id))).toBe(true);
   const explicitlyStopped=sources.filter(source=>closeClick.activeSourceIds.includes(source.id)),naturallyEnded=sources.filter(source=>!closeClick.activeSourceIds.includes(source.id));
   expect(explicitlyStopped.every(source=>source.disconnected&&source.stopAt===0)).toBe(true);expect(naturallyEnded.every(source=>source.ended&&source.disconnected&&source.stopAt!==null&&source.stopAt>0)).toBe(true);
   explicitStopSources+=explicitlyStopped.length;naturalEndSources+=naturallyEnded.length;if(explicitlyStopped.length)explicitStopCycles++;if(naturallyEnded.length)naturalEndCycles++;
   expect(closed.starts).toBe(sounding.starts);expect(await slots(page)).toEqual(before);
   phase='pausing';await h.activate(page.locator('#v4-menu'));await expect(page.locator('#v4-dialog-title')).toHaveText('炉火为你留着');await quiet(page);await suspended(page);
   const paused=await releaseAudioSnapshot(page);expect(paused.starts).toBe(closed.starts);expect(paused.active).toBe(0);
   phase='resuming';await h.activate(page.getByRole('button',{name:'继续锻造',exact:true}));await expect(page.locator('#v4-dialog')).not.toBeVisible();await quiet(page);
   const resumed=await releaseAudioSnapshot(page);expect(resumed.starts).toBe(closed.starts);expect(resumed.sources.every(source=>source.disconnected)).toBe(true);expect(await slots(page)).toEqual(before);
   cycles.push({cycle,sounding:{starts:sounding.starts,active:sounding.active,maxActive:sounding.maxActive,capturedPeak:sounding.capturedPeak},closed:{starts:closed.starts,active:closed.active,actualTrustedClose:closeClick,explicitStopSources:explicitlyStopped.length,naturalEndSources:naturallyEnded.length,sources},paused:{starts:paused.starts,active:paused.active,states:paused.states},resumed:{starts:resumed.starts,active:resumed.active,states:resumed.states}});
  }
  phase='idle-windows';const completed=await releaseAudioSnapshot(page);expect(completed.starts).toBe(60);expect(completed.capturedPeak).toBeGreaterThan(.001);outputGraph(completed);
  const idle:Record<string,unknown>[]=[];
  for(const durationMs of [800,500]){await page.waitForTimeout(durationMs);const observed=await releaseAudioSnapshot(page);expect(observed.starts).toBe(completed.starts);expect(observed.active).toBe(0);expect(observed.sources.every(source=>source.disconnected)).toBe(true);expect(await slots(page)).toEqual(before);idle.push({durationMs,starts:observed.starts,active:observed.active,states:observed.states});}
  expect(explicitStopSources+naturalEndSources).toBe(60);phase='complete';await record(info,'twenty-real-audio-cycles',{before,cycles,idle,explicitStopSources,naturalEndSources,explicitStopCycles,naturalEndCycles,final:await releaseAudioSnapshot(page),scope:'Twenty actual UI previews each observed sounding. Native sources still active at the trusted close click must be explicitly stopped/disconnected; sources already naturally ended must be ended/disconnected. Actual explicit-stop and natural-end counts are reported separately, with no claim that all twenty closes preceded natural ending. Every close/pause/resume retains identical raw economic slots, and both later real idle windows stay silent.'});await h.finish({audioSettingsPauseCycles:20,previewSources:60,explicitStopSources,naturalEndSources,explicitStopCycles,naturalEndCycles,idleWindowsMs:[800,500],gameplayCommands:1});
 }finally{
  await record(info,'twenty-cycle-final-observation',{cycle:cycleAtFailure,phase,completedCycles:cycles,initial,explicitStopSources,naturalEndSources,explicitStopCycles,naturalEndCycles,audio:await releaseAudioSnapshot(page).catch(error=>({error:String(error)})),visibleStatus:await page.locator('#v4-audio-status').getAttribute('data-state').catch(()=>null),visibleDialog:await page.locator('#v4-dialog-title').textContent().catch(()=>null),actualGameSlots:await slots(page).catch(error=>({error:String(error)}))});
 }
});

test('v5 release a fresh explicit preview owns native resume when an older game resume crosses settings',async({page},info)=>{
 const h=await prepared(page,info),before=await slots(page),observations:Record<string,unknown>[]=[];let phase='before-pause';
 try{
  await h.activate(page.locator('#v4-menu'));await expect(page.locator('#v4-dialog-title')).toHaveText('炉火为你留着');await suspended(page);
  await h.activate(page.getByRole('button',{name:'继续锻造',exact:true}));await expect(page.locator('#v4-dialog')).not.toBeVisible();await suspended(page);
  await setReleaseAudioFaults(page,{defer:true});phase='opening-settings-with-held-game-resume';await settings(h);
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).deferred).toBe(true);const held=await releaseAudioSnapshot(page);expect(held.hasDeferredResume).toBe(true);expect(held.starts).toBe(0);observations.push({phase,audio:held});
  phase='fresh-explicit-preview';await h.activate(page.getByRole('button',{name:'试听敲击声',exact:true}));observations.push({phase,audio:await releaseAudioSnapshot(page)});
  phase='release-older-native-resume';await releaseDeferredAudio(page);await audioState(page,'ready');await expect.poll(async()=>(await releaseAudioSnapshot(page)).starts).toBe(3);await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);
  const fresh=await releaseAudioSnapshot(page);expect(fresh.resumeCalls).toBeGreaterThan(held.resumeCalls);expect(fresh.states).toEqual(['running']);outputGraph(fresh);expect(await slots(page)).toEqual(before);observations.push({phase,audio:fresh});
  phase='close-and-pause';await closeSettings(h);await quiet(page);expect((await releaseAudioSnapshot(page)).sources.every(source=>source.disconnected)).toBe(true);await h.activate(page.locator('#v4-menu'));await suspended(page);expect(await slots(page)).toEqual(before);await h.activate(page.getByRole('button',{name:'继续锻造',exact:true}));await quiet(page);expect((await releaseAudioSnapshot(page)).starts).toBe(3);expect(await slots(page)).toEqual(before);
  phase='complete';await h.finish({scope:'Deterministic named platform fault: settings pointerdown starts a held game resume; one fresh explicit preview must obtain its own native activation and survive completion of the older request. Not a claim about the exact scheduling of preflight-normal-01.'});
 }finally{
  await record(info,'fresh-preview-crossed-resume',{phase,before,observations,audio:await releaseAudioSnapshot(page).catch(error=>({error:String(error)})),visibleStatus:await page.locator('#v4-audio-status').getAttribute('data-state').catch(()=>null),actualGameSlots:await slots(page).catch(error=>({error:String(error)})),fault:'Only the first native resume requested after actual pause/resume is held, using the existing AudioContext probe. No game state or UI activation is synthesized.'});
 }
});

test('v5 release safeBurst commits atomically and pause cancels unplayed contacts and native sources through reload',async({page},info)=>{
 const fixture=strikeFixture('safeBurst'),h=await prepared(page,info,{},fixture);await readyWithoutPreview(h);await h.select(fixture.action.pieceId);await resetReleaseAudioCapture(page);const before=await releaseAudioSnapshot(page);
 await acceptedByV5(h,fixture.action,async()=>{await page.locator('#v4-hit').click();await page.keyboard.press('Escape');});await expect(page.locator('#v4-dialog-title')).toHaveText('炉火为你留着');expect((await h.read()).state).toEqual(fixture.after);await quiet(page);await suspended(page);const cancelled=await releaseAudioSnapshot(page);expect(cancelled.starts-before.starts).toBeLessThan(impactTones(fixture.strike).length);
 await page.waitForTimeout(900);expect((await releaseAudioSnapshot(page)).starts).toBe(cancelled.starts);expect((await h.read()).state).toEqual(fixture.after);await expect(page.locator('#v4-hammer')).toHaveAttribute('data-phase','idle');expect(await page.locator('#v4-scene').evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
 await h.reload();expect((await releaseAudioSnapshot(page)).constructors).toBe(0);await h.activate(page.locator('#v4-continue'));expect((await h.read()).state).toEqual(fixture.after);expect((await releaseAudioSnapshot(page)).starts).toBe(0);await record(info,'safeBurst-pause-reload',{fixture,before,cancelled,afterReload:await releaseAudioSnapshot(page)});await h.finish();
});
