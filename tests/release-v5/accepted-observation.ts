import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {Action,RunState} from '../../src/core-v5/index.js';
import type {CollectionState} from '../../src/application/v5-collection.js';
import {KeyboardV5,v5Sdk} from '../e2e/v5-helpers.js';

const SAVE='sword-led.save.v5';
interface Identity {runId:string;revision:number}
interface RawSlots {save:string|null;backup:string|null;collection:string|null;collectionBackup:string|null}
interface Capture {
 label:string;identity:Identity;raw:RawSlots;state:unknown;expected:RunState;
 action:Action|null;verified:boolean;oracle?:{startedAt:string;endedAt:string;milliseconds:number;codecCalls:number};
}
interface ObserverOptions {name?:string;collection?:CollectionState}
interface ContinueEvent {at:number;endedAt:number|null;cost:number|null;trusted:boolean;workshopVisible:boolean|null}
interface ContinueReady {at:number;readyState:DocumentReadyState;method:string}
interface AcceptedDiagnostics {continueEvents:ContinueEvent[];continueReady:ContinueReady|null}
declare global {interface Window {v5AcceptedDiagnostics:AcceptedDiagnostics}}

/** Observe the actual Continue event interval; never wrap product listener registration or warm audio. */
export async function installAcceptedDiagnostics(page:Page){
 await page.addInitScript(()=>{
  const probe:AcceptedDiagnostics={continueEvents:[],continueReady:null};window.v5AcceptedDiagnostics=probe;
  // Timestamp the first real visible/enabled title projection inside the page. This observer
  // disconnects permanently before Continue or the first forge input; it never decodes a save.
  const readyObserver=new MutationObserver(checkContinueReady);
  function checkContinueReady(){
   if(probe.continueReady)return;
   const button=document.querySelector<HTMLButtonElement>('#v4-continue'),title=document.querySelector<HTMLElement>('#v4-title');
   if(!button||!title||!button.isConnected||button.disabled||button.hidden||title.hidden)return;
   for(let node:HTMLElement|null=button;node;node=node.parentElement){
    if(node.hidden)return;const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)return;
   }
   if(!button.getClientRects().length||!title.getClientRects().length)return;
   probe.continueReady={at:performance.now(),readyState:document.readyState,method:'First MutationObserver callback seeing actual connected title Continue enabled and CSS-visible with visible title/ancestors; page clock, not a product hook, event assignment timestamp or compositor paint time.'};
   readyObserver.disconnect();
  }
  readyObserver.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','style','class']});
  checkContinueReady();
  const continuing=new WeakMap<Event,ContinueEvent>();
  window.addEventListener('click',event=>{if(!(event.target instanceof Element)||!event.target.closest('#v4-continue'))return;const row:ContinueEvent={at:performance.now(),endedAt:null,cost:null,trusted:event.isTrusted,workshopVisible:null};probe.continueEvents.push(row);continuing.set(event,row);},true);
  window.addEventListener('click',event=>{const row=continuing.get(event);if(!row)return;row.endedAt=performance.now();row.cost=row.endedAt-row.at;const workshop=document.querySelector<HTMLElement>('#v4-workshop');row.workshopVisible=!!workshop&&!workshop.hidden;});
 });
}

/** Parse only identity inside the matcher; no shipping decoder, replay or layout sampling here. */
export async function readAcceptedIdentity(page:Page):Promise<Identity|null>{
 return page.evaluate(key=>{
  const plain=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
  try{const raw=localStorage.getItem(key);if(raw===null)return null;const envelope:unknown=JSON.parse(raw);if(!plain(envelope)||envelope.schemaVersion!==5||envelope.rulesVersion!=='forge-v5'||!plain(envelope.state))return null;const state=envelope.state;return typeof state.runId==='string'&&typeof state.revision==='number'&&Number.isSafeInteger(state.revision)?{runId:state.runId,revision:state.revision}:null;}catch{return null;}
 },SAVE);
}
export async function readAcceptedRaw(page:Page):Promise<RawSlots>{
 return page.evaluate(()=>({save:localStorage.getItem('sword-led.save.v5'),backup:localStorage.getItem('sword-led.save.backup.v5'),collection:localStorage.getItem('sword-led.collection.v2'),collectionBackup:localStorage.getItem('sword-led.collection.backup.v2')}));
}
function parsedState(raw:string|null):unknown{
 if(raw===null)throw Error('Actual saved run is absent');const envelope:unknown=JSON.parse(raw);
 if(typeof envelope!=='object'||envelope===null||!('schemaVersion'in envelope)||envelope.schemaVersion!==5||!('rulesVersion'in envelope)||envelope.rulesVersion!=='forge-v5'||!('state'in envelope))throw Error('Actual run envelope is not schema5/forge-v5');return envelope.state;
}
function trustedAwards(state:RunState):CollectionState{
 const awards=v5Sdk.getCollectionAwards(state);
 return{chapters:awards.chapters,mastery:awards.mastery,traits:awards.traits,challenge:awards.challenge,works:awards.works.map<CollectionState['works'][number]>(work=>({...work,rulesVersion:'forge-v5'}))};
}

/** Real raw capture now; one formal shipping codec replay per captured snapshot after measurement. */
export function createAcceptedObserver(h:KeyboardV5,initial:RunState,options:ObserverOptions={}){
 let state=initial,verifiedCount=0,expectedCollection:CollectionState=options.collection??trustedAwards(initial);
 const captures:Capture[]=[],failures:unknown[]=[],name=options.name??'release',file=h.info.outputPath('accepted-observation-'+name+'.json');
 const actualSnapshot=async(label:string)=>({label,raw:await readAcceptedRaw(h.page),identity:await readAcceptedIdentity(h.page),runtime:await h.page.evaluate(()=>({runtime:window.t03Runtime?.sample()??null,diagnostics:window.v5AcceptedDiagnostics?{continueEvents:window.v5AcceptedDiagnostics.continueEvents,continueReady:window.v5AcceptedDiagnostics.continueReady}:null,hidden:document.hidden,focused:document.hasFocus(),body:document.body.innerText}))});
 async function persist(label='captured-evidence'){
  await writeFile(file,JSON.stringify({scope:'Actual raw identities and snapshots; captures remain explicitly unverified until verifyAll runs one shipping codec/full replay per snapshot after page measurement. Test-side oracle duration is separate from page budgets.',label,captures,failures,verifiedCount},null,2)+'\n');
 }
 async function capture(label:string,action:Action|null=null){
  const raw=await readAcceptedRaw(h.page),plain=parsedState(raw.save),identity=await readAcceptedIdentity(h.page);expect(identity).toEqual({runId:state.runId,revision:state.revision});expect(plain).toEqual(state);
  const row:Capture={label,identity:{runId:state.runId,revision:state.revision},raw,state:plain,expected:state,action,verified:false};captures.push(row);return row;
 }
 async function accept(action:Action,input:()=>Promise<void>,label:string=action.type){
  let expected:RunState|null=null;
  try{
   if(!captures.length)await capture('trusted-initial-boundary');
   const before=state,beforeRaw=await readAcceptedRaw(h.page);expect(parsedState(beforeRaw.save)).toEqual(before);
   const result=v5Sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!result.ok)throw Error('Public command precondition rejected: '+result.error);expected=result.state;
   await input();await expect.poll(()=>readAcceptedIdentity(h.page)).toEqual({runId:result.state.runId,revision:result.state.revision});
   state=result.state;await capture(label,action);
   h.accepted.push({action,runId:before.runId,mode:before.mode,day:before.day,revision:state.revision,coinsBefore:before.coins,coinsAfter:state.coins,events:result.events});
   return result;
  }catch(error){
   failures.push({label,action,expected,error:String(error),actual:await actualSnapshot('failed-light-observation').catch(reason=>({captureError:String(reason)}))});await persist('failed-light-observation');throw error;
  }
 }
 async function verifyAll(){
  // Layout metrics are sampled once after the caller's animation/idle interval, never per input.
  const metrics=await h.metrics();
  try{
   while(verifiedCount<captures.length){
    const row=captures[verifiedCount]!,startedAt=new Date().toISOString(),start=process.hrtime.bigint();
    try{
     const checked=v5Sdk.decodeV5Save(row.raw.save);expect(checked.status).toBe('valid');if(checked.status!=='valid')throw Error('Actual captured save failed formal codec: '+JSON.stringify(checked));expect(checked.state).toEqual(row.expected);expect(checked.state).toEqual(row.state);
     let collection:CollectionState|null=null;
     if(row.raw.collection!==null){const decoded=v5Sdk.decodeCollection(row.raw.collection);expect(decoded.status).toBe('valid');if(decoded.status!=='valid')throw Error('Actual captured collection failed formal codec');collection=decoded.state;}
     expectedCollection=v5Sdk.mergeCollections(expectedCollection,trustedAwards(checked.state));expect(collection).toEqual(expectedCollection);
     row.verified=true;
     // Actual decoded state/raw in the established archive schema, not the producer's expected object.
     h.observations.push({label:row.label,state:checked.state,collection,raw:{save:row.raw.save!,collection:row.raw.collection},metrics});verifiedCount++;
    }finally{row.oracle={startedAt,endedAt:new Date().toISOString(),milliseconds:Number(process.hrtime.bigint()-start)/1e6,codecCalls:1};}
   }
  }finally{
   await persist('formal-verification-after-page-idle');
   await writeFile(h.info.outputPath('v5-states.json'),JSON.stringify(h.observations,null,2));await writeFile(h.info.outputPath('v5-commands.json'),JSON.stringify(h.accepted,null,2));
  }
  return captures.map(row=>({label:row.label,identity:row.identity,verified:row.verified,oracle:row.oracle,metricsSampledAfterGroup:true}));
 }
 return{get state(){return state;},captures,capture,accept,verifyAll,persist,actualSnapshot};
}
