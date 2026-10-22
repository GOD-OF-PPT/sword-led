import {expect} from '@playwright/test';
import type {Page,TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import type {Action,RunState} from '../../src/core-v5/index.js';
import {KeyboardV5,v5Envelopes,v5Sdk,v5VictoryGuide} from '../e2e/v5-helpers.js';

export const T03_KEYS=['sword-led.save.v5','sword-led.save.backup.v5','sword-led.collection.v2','sword-led.collection.backup.v2','sword-led.settings.v1'] as const;
export const T03_SIZES=[{width:1280,height:720},{width:1920,height:1080}] as const;
export const T03_BUDGETS={callbackP95Ms:16.7,callbackInvestigateMaxMs:50,shortHandlerP95Ms:50,shortHandlerMaxMs:100,longHandlerP95Ms:100,longHandlerMaxMs:200,loadMs:3000,inputToAcceptedMs:150,firstContactMs:200};
export function t03Step(state:RunState,action:Action){const result=v5Sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${state.day}/${state.revision}/${action.type}: ${result.error}`);return result;}
export function t03Prefix(predicate:(state:RunState)=>boolean){
 const made=v5Sdk.createRun({runId:'g4-t03-legal-boundary',seed:'v5-economy-0'});if(!made.ok)throw Error(made.error);let state=made.state;
 for(const action of v5VictoryGuide){if(predicate(state))return state;state=t03Step(state,action).state;}
 if(predicate(state))return state;throw Error('Required current v5 legal guide boundary absent');
}
export const t03Workshop=(day=1)=>t03Prefix(state=>state.day===day&&state.phase==='workshop');
export function t03StrikeFixture(kind:'ordinary'|'burst'){
 let state=t03Prefix(()=>true);
 for(const action of v5VictoryGuide){const result=t03Step(state,action),strike=result.events.find(event=>event.type==='Strike');if(action.type==='strike'&&strike?.type==='Strike'&&(kind==='burst'?strike.burst:!strike.burst))return{before:state,action,after:result.state,strike};state=result.state;}
 throw Error('Approved current v5 guide has no '+kind+' strike');
}
const pressureCache=new Map<number,RunState>();
/** Real reserve/take-back commands pad a legal pressure boundary; no wallet, phase or RNG assignment. */
export function t03Pressure(length=1898){
 const cached=pressureCache.get(length);if(cached)return cached;
 let state=t03Workshop(4);const spare=state.blades.find(blade=>blade.suppliedDay===4&&blade.status==='active');if(!spare)throw Error('No legal day-four spare');
 if(length<state.journal.length||length>=1900)throw Error('Pressure fixture must remain below the soft limit');
 while(state.journal.length<length)state=t03Step(state,{type:'reserve',pieceId:spare.id}).state;
 const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);
 const envelope=v5Envelopes(checked.state);if(Buffer.byteLength(envelope.run)>=256*1024)throw Error('Legal long fixture exceeds shipping codec size');
 pressureCache.set(length,checked.state);return checked.state;
}
let qualifiedNear:{state:RunState;commissionPieceId:string;paddingPieceId:string;sourceRevision:number}|null=null;
/** Separate exit boundary: the ordinary pressure performance fixture deliberately stays unworked. */
export function t03QualifiedNearLimit(){
 if(qualifiedNear)return qualifiedNear;
 let state=t03Prefix(value=>value.day===4&&value.phase==='workshop'&&v5Sdk.getRunView(value).blades.some(row=>row.willCommission&&row.assessment.canDeliver&&!row.reserved));const sourceRevision=state.revision;
 const commissioned=v5Sdk.getRunView(state).blades.find(row=>row.willCommission&&row.assessment.canDeliver&&!row.reserved),spare=state.blades.find(blade=>blade.status==='active'&&blade.id!==commissioned?.blade.id);
 if(!commissioned||!spare)throw Error('Legal day-four prefix lacks both a qualified commission sword and a separate padding spare');
 const commissionPieceId=commissioned.blade.id,paddingPieceId=spare.id;
 while(state.journal.length<1898)state=t03Step(state,{type:'reserve',pieceId:paddingPieceId}).state;
 const candidate=v5Sdk.getRunView(state).blades.find(row=>row.blade.id===commissionPieceId);
 if(state.journal.length!==1898||!candidate?.willCommission||!candidate.assessment.canDeliver||candidate.reserved)throw Error('Padding changed the legitimate delivery qualification');
 const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);const envelope=v5Envelopes(checked.state);if(Buffer.byteLength(envelope.run)>=256*1024)throw Error('Qualified long fixture exceeds shipping codec size');
 qualifiedNear={state:checked.state,commissionPieceId,paddingPieceId,sourceRevision};return qualifiedNear;
}
export const t03NearLimit=()=>t03QualifiedNearLimit().state;
export function t03CrackedLong(){
 const made=v5Sdk.createRun({runId:'g4-t03-cracked-pressure',seed:'g4-t03-cracked-pressure'});if(!made.ok)throw Error(made.error);let state=t03Step(made.state,{type:'continue'}).state;
 for(let n=0;n<90;n++){
  const piece=v5Sdk.getRunView(state).blades.find(row=>row.canStrike);if(!piece)throw Error('Finite damage route exhausted all blades');
  const action={type:'strike' as const,pieceId:piece.blade.id},next=t03Step(state,action);
  if(piece.blade.cracked&&!v5Sdk.strikeOdds(state,piece.blade).burst){
   const spare=state.blades.find(blade=>blade.status==='active'&&blade.id!==piece.blade.id);if(!spare)throw Error('No spare for legal cracked pressure padding');
   while(state.journal.length<1898)state=t03Step(state,{type:'reserve',pieceId:spare.id}).state;
   const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);const result=t03Step(state,action);return{before:checked.state,action,after:result.state,events:result.events};
  }
  state=next.state;
 }
 throw Error('Finite90-command damage route never yielded a real cracked blade');
}
export function t03FixtureProof(){
 const fixture=t03QualifiedNearLimit(),near=fixture.state;let exit=near;const tail:Action[]=[],accepted:{action:Action;revision:number;events:unknown}[]=[];
 const send=(action:Action)=>{const result=t03Step(exit,action);exit=result.state;tail.push(action);accepted.push({action,revision:exit.revision,events:result.events});return result;};
 send({type:'reserve',pieceId:fixture.paddingPieceId});send({type:'reserve',pieceId:fixture.paddingPieceId});const softLimit=exit;
 if(softLimit.journal.length!==1900)throw Error('Qualified exit proof did not reach soft1900');
 const delivery=send({type:'deliver',pieceId:fixture.commissionPieceId});if(!delivery.events.some(event=>event.type==='Delivered'&&event.matched)||!delivery.events.some(event=>event.type==='MainCompleted'))throw Error('Soft-limit exit did not actually complete the main commission');
 if(exit.reserveId)send({type:'reserve',pieceId:exit.reserveId});
 const sale=v5Sdk.getRunView(exit).blades.find(row=>row.assessment.canDeliver&&!row.quote.matched&&!row.reserved);if(!sale)throw Error('Qualified current exit fixture no longer offers its promised ordinary spare sale; do not silently skip it');
 const sold=send({type:'deliver',pieceId:sale.blade.id});if(!sold.events.some(event=>event.type==='Delivered'&&!event.matched))throw Error('Ordinary spare sale was not a real unmatched delivery');
 const scrap=v5Sdk.getRunView(exit).blades.find(row=>!row.reserved);if(!scrap)throw Error('Qualified exit fixture has no remaining real recovery spare');send({type:'scrap',pieceId:scrap.blade.id});
 while(!['victory','return','defeat'].includes(exit.phase)){
  const action:Action=exit.phase==='workshop'?{type:'settle'}:exit.phase==='chapter'?{type:'chooseModification',modification:exit.chapterChoices[0]!}:{type:'advance'};
  send(action);if(tail.length>100||exit.journal.length>v5Sdk.JOURNAL_LIMIT)throw Error('Legal long boundary has no bounded exit');
 }
 const checked=v5Sdk.validateRun(exit);if(!checked.ok)throw Error(checked.detail);
 return{scope:'Finite current shipping SDK replay/codec proof for an already qualified sword at a declared restored pressure exit. Public-command main delivery, ordinary sale, recovery and bounded exits are distinct. Not fresh gameplay, a model sweep or a fun assessment.',near:{journal:near.journal.length,day:near.day,phase:near.phase,bytes:Buffer.byteLength(v5Envelopes(near).run),commissionPieceId:fixture.commissionPieceId,paddingPieceId:fixture.paddingPieceId,sourceRevision:fixture.sourceRevision,state:near},softLimit,exit:{accepted,tail,state:exit},ordinary:t03StrikeFixture('ordinary'),burst:t03StrikeFixture('burst')};
}
export async function t03Driver(page:Page,info:TestInfo){const h=new KeyboardV5(page,info,'mouse');await h.install();return h;}
export async function t03Slots(page:Page){return page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),T03_KEYS);}
export async function t03Record(info:TestInfo,name:string,value:unknown){await writeFile(info.outputPath(name+'.json'),JSON.stringify(value,null,2)+'\n');await info.attach(name,{path:info.outputPath(name+'.json'),contentType:'application/json'});}
export async function t03Export(page:Page){
 await page.locator('#v4-save-open').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前行程',exact:true}).click();const file=await(await pending).path();if(!file)throw Error('No actual UI export file');
 const decoded=v5Sdk.validateRun(JSON.parse(await readFile(file,'utf8')));if(!decoded.ok)throw Error(decoded.detail);await page.getByRole('button',{name:'回到当前页面',exact:true}).click();return decoded.state;
}
export async function t03Idle(page:Page){
 await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await page.waitForTimeout(800);
 const before=await page.evaluate(()=>window.t03Runtime.sample());await page.waitForTimeout(500);const after=await page.evaluate(()=>window.t03Runtime.sample());
 expect(after.frames.length-before.frames.length).toBe(0);expect(after.pending).toBe(0);expect(after.runningAnimations).toBe(0);return{before,after};
}
export function t03Stats(values:readonly number[]){const a=[...values].sort((x,y)=>x-y);return{n:a.length,min:a[0]??null,p50:a[Math.max(0,Math.ceil(a.length*.5)-1)]??null,p95:a[Math.max(0,Math.ceil(a.length*.95)-1)]??null,max:a.at(-1)??null};}

export interface T03InputSample {kind:string;at:number;trusted:boolean;revisionBefore:number|null;acceptedAt:number|null;acceptedRevision:number|null;contactAt:number|null;idleAt:number|null}
export interface T03Visibility {visibilityState:DocumentVisibilityState;hidden:boolean;hasFocus:boolean}
export interface T03PageLifecycle extends T03Visibility {type:string;at:number;trusted:boolean|null}
export interface T03Frame {requestedAt:number;stamp:number;at:number;cost:number;requestedVisibility:T03Visibility;deliveredVisibility:T03Visibility}
export interface T03Handler {type:string;target:string;key:string;trusted:boolean;cost:number}
export interface T03RuntimeSample {frames:T03Frame[];handlers:T03Handler[];inputs:T03InputSample[];contacts:{at:number;inputIndex:number}[];pageLifecycle:T03PageLifecycle[];pending:number;requested:number;cancelled:number;runningAnimations:number;listeners:{target:string;type:string;capture:boolean;connected:boolean}[];domNodes:number;longTasks:number[]|null;environment:{width:number;height:number;dpr:number;ua:string;hardwareConcurrency:number;visibilityState:DocumentVisibilityState;hidden:boolean;hasFocus:boolean}}
interface T03Runtime {sample():T03RuntimeSample;reset():void;cadence(hz:number|null):void;hold(value:boolean):void}
declare global {interface Window {t03Runtime:T03Runtime}}

/** Observer/transport/scheduler only. The actual listeners, Canvas work and Storage writes run unchanged. */
export async function installT03Runtime(page:Page){await page.addInitScript(()=>{
 const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window);
 const timeout=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window),get=Storage.prototype.getItem,set=Storage.prototype.setItem;
 const targetName=(target:EventTarget)=>target===window?'window':target===document?'document':target instanceof Element?`${target.tagName.toLowerCase()}${target.id?'#'+target.id:''}`:target instanceof MediaQueryList?`media:${target.media}`:target.constructor.name;
 type Registration={target:EventTarget;type:string;capture:boolean;listener:EventListenerOrEventListenerObject;wrapper:EventListener;active:boolean};
 const registrations:Registration[]=[],pending=new Map<number,{native:number;timer:boolean;requestedAt:number;requestedVisibility:T03Visibility}>();
 const visibility=():T03Visibility=>({visibilityState:document.visibilityState,hidden:document.hidden,hasFocus:document.hasFocus()});
 const pageLifecycle:T03PageLifecycle[]=[{type:'probe-installed',at:performance.now(),trusted:null,...visibility()}];
 const recordLifecycle=(event:Event)=>{pageLifecycle.push({type:event.type,at:performance.now(),trusted:event.isTrusted,...visibility()});};
 // Probe-owned native listeners stay outside the product listener inventory. No timer or RAF is added.
 for(const type of ['focus','blur'])add.call(window,type,recordLifecycle,true);
 add.call(document,'visibilitychange',recordLifecycle,true);
 let frames:T03Frame[]=[],handlers:T03Handler[]=[],inputs:T03InputSample[]=[],contacts:{at:number;inputIndex:number}[]=[],longTasks:number[]|null=null,requested=0,cancelled=0,serial=0,hz:number|null=null,held=false;
 const currentRevision=()=>{try{const raw=get.call(localStorage,'sword-led.save.v5');return raw?Number((JSON.parse(raw) as {state:{revision:number}}).state.revision):null;}catch{return null;}};
 const startInput=(event:Event)=>{const target=event.target,keyboard=event instanceof KeyboardEvent?event:null,pointer=event instanceof PointerEvent?event:null;
  if(!(target instanceof Element)||!['v4-hit','v4-strike'].includes(target.id))return;
  if(pointer&&(event.type!=='pointerdown'||pointer.button!==0))return;
  if(keyboard&&!((event.type==='keyup'&&keyboard.code==='Space')||(event.type==='keydown'&&keyboard.key==='Enter'&&!keyboard.repeat)))return;
  if(!pointer&&!keyboard)return;
  inputs.push({kind:pointer?'pointer':keyboard?.code==='Space'?'space':'enter',at:performance.now(),trusted:event.isTrusted,revisionBefore:currentRevision(),acceptedAt:null,acceptedRevision:null,contactAt:null,idleAt:null});
 };
 for(const type of ['pointerdown','keydown','keyup'])add.call(window,type,startInput,true);
 EventTarget.prototype.addEventListener=function(type,listener,options){
  if(!listener)return add.call(this,type,listener,options);const capture=typeof options==='boolean'?options:!!options?.capture;
  const old=registrations.find(item=>item.active&&item.target===this&&item.type===type&&item.capture===capture&&item.listener===listener);if(old)return;
  const target=this,once=typeof options==='object'&&!!options.once;let registration:Registration;
  const wrapper:EventListener=function(this:EventTarget,event){if(once)registration.active=false;const begin=performance.now();try{if(typeof listener==='function')listener.call(this,event);else listener.handleEvent(event);}finally{if(event instanceof KeyboardEvent||event instanceof PointerEvent){handlers.push({type,target:targetName(target),key:event instanceof KeyboardEvent?event.code:'',trusted:event.isTrusted,cost:performance.now()-begin});}}};
  registration={target,type,capture,listener,wrapper,active:true};registrations.push(registration);
  if(typeof options==='object'&&options.signal){if(options.signal.aborted)registration.active=false;else add.call(options.signal,'abort',()=>{registration.active=false;},{once:true});}
  return add.call(this,type,wrapper,options);
 };
 EventTarget.prototype.removeEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture,item=registrations.find(value=>value.active&&value.target===this&&value.type===type&&value.capture===capture&&value.listener===listener);if(item){item.active=false;return remove.call(this,type,item.wrapper,options);}return remove.call(this,type,listener,options);};
 Storage.prototype.setItem=function(key,value){
  const result=set.call(this,key,value);
  if(key==='sword-led.save.v5'){
   const last=inputs.at(-1);
   if(last&&last.acceptedAt===null){
    try{
     const revision=Number((JSON.parse(value) as {state:{revision:number}}).state.revision);
     if(revision===(last.revisionBefore??-2)+1){last.acceptedAt=performance.now();last.acceptedRevision=revision;}
    }catch{/* Record only actual valid shape; no replacement result. */}
   }
  }
  return result;
 };
 const deliver=(id:number,stamp:number)=>{const item=pending.get(id);if(!item)return;if(held){item.native=raf(next=>deliver(id,next));item.timer=false;return;}pending.delete(id);const deliveredVisibility=visibility(),begin=performance.now();const callback=callbacks.get(id);callbacks.delete(id);try{callback?.(stamp);}finally{frames.push({requestedAt:item.requestedAt,stamp,at:begin,cost:performance.now()-begin,requestedVisibility:item.requestedVisibility,deliveredVisibility});}};
 const callbacks=new Map<number,FrameRequestCallback>();
 window.requestAnimationFrame=callback=>{const id=++serial,requestedAt=performance.now(),requestedVisibility=visibility();requested++;callbacks.set(id,callback);const native=hz===null?raf(stamp=>deliver(id,stamp)):timeout(()=>deliver(id,performance.now()),1000/hz);pending.set(id,{native,timer:hz!==null,requestedAt,requestedVisibility});return id;};
 window.cancelAnimationFrame=id=>{const item=pending.get(id);if(item){if(item.timer)clear(item.native);else caf(item.native);pending.delete(id);callbacks.delete(id);cancelled++;}};
 const observer=new MutationObserver(records=>{const last=inputs.at(-1);if(!last||last.acceptedAt===null)return;for(const record of records){const node=record.target;if(!(node instanceof HTMLElement))continue;if(record.attributeName==='data-phase'&&node.id==='v4-hammer'&&node.dataset.phase==='contact'&&record.oldValue!=='contact'){const at=performance.now();if(last.contactAt===null)last.contactAt=at;contacts.push({at,inputIndex:inputs.length-1});}if(node.id==='v4-strike'&&node.getAttribute('aria-busy')==='false')last.idleAt=performance.now();}});
 observer.observe(document,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['data-phase','aria-busy']});
 if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('longtask')){longTasks=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks!.push(entry.duration);}).observe({entryTypes:['longtask']});}
 window.t03Runtime={cadence(value){hz=value;},hold(value){held=value;},reset(){frames=[];handlers=[];inputs=[];contacts=[];requested=0;cancelled=0;if(longTasks)longTasks=[];pageLifecycle.push({type:'measurement-reset',at:performance.now(),trusted:null,...visibility()});},sample(){return{frames:[...frames],handlers:[...handlers],inputs:inputs.map(item=>({...item})),contacts:[...contacts],pageLifecycle:pageLifecycle.map(item=>({...item})),pending:pending.size,requested,cancelled,runningAnimations:document.getAnimations().filter(animation=>animation.playState==='running'||animation.pending).length,listeners:registrations.filter(item=>item.active).map(item=>({target:targetName(item.target),type:item.type,capture:item.capture,connected:item.target instanceof Node?item.target.isConnected:true})),domNodes:document.querySelectorAll('*').length,longTasks:longTasks?[...longTasks]:null,environment:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,ua:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,...visibility()}};}};
 });}

/** The harness is a separately built test artifact; it is never the product entry or SDK. */
export async function routeT03Lifecycle(page:Page){
 const directory=process.env.V5_T03_LIFECYCLE_DIR??'tmp/goal4-T03/harness';
 await page.route('**/t03-lifecycle/**',async route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/t03-lifecycle/'||path==='/t03-lifecycle/index.html')await route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><link rel="stylesheet" href="/t03-lifecycle/style.css"></head><body><div id="app"></div><script type="module" src="/t03-lifecycle/lifecycle.js"></script></body></html>'});
  else if(path==='/t03-lifecycle/lifecycle.js'||path==='/t03-lifecycle/style.css')await route.fulfill({path:directory+'/'+path.split('/').at(-1),contentType:path.endsWith('.js')?'application/javascript':'text/css'});
  else await route.abort('failed');
 });
}
