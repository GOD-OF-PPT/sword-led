import {expect} from '@playwright/test';
import type {Page,TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {Action,RunState} from '../../src/core-v5/index.js';
import type {CollectionState} from '../../src/application/v5-collection.js';
import {KeyboardV5,v5Sdk,v5VictoryGuide} from './v5-helpers.js';

export const STORAGE_KEYS={run:'sword-led.save.v5',backup:'sword-led.save.backup.v5',book:'sword-led.collection.v2',bookBackup:'sword-led.collection.backup.v2',preferences:'sword-led.settings.v1',legacyBook:'sword-led.collection.v1',legacyBookBackup:'sword-led.collection.backup.v1'} as const;
export const ALL_STORAGE_KEYS=[...Object.values(STORAGE_KEYS),'sword-led.save.v1','sword-led.save.v2','sword-led.save.v3','sword-led.save.v4','sword-led.save.backup.v4'] as const;
const STAMP='2026-10-21T00:00:00.000Z';
export interface StorageFaults {read:string[];write:string[];denyGetter:boolean;rejectLease:boolean}
interface ProbeWrite {key:string;value:string|null;accepted:boolean;operation:'set'|'remove'|'clear'}
interface StorageProbe {
 faults:StorageFaults;
 writes:ProbeWrite[];
 events:{key:string|null;value:string|null;trusted:boolean}[];
 raw():Record<string,string|null>;
 callbacks:Record<string,()=>void>;
}
declare global {interface Window {v5StorageProbe:StorageProbe}}

/** Rebuild a genuine prefix with shipping commands; these are restored boundaries, never new UI campaigns. */
let guidePrefixes:readonly RunState[]|null=null;
export function storagePrefix(predicate:(state:RunState)=>boolean):RunState {
 if(!guidePrefixes){
  const source=JSON.parse(readFileSync('docs/evidence/T11-4-2-3l1/journeys/victory.json','utf8')) as {state:RunState};
  const made=v5Sdk.createRun({runId:source.state.runId,seed:source.state.seed,mode:source.state.mode,eligibility:source.state.initialEligibility});
  if(!made.ok)throw Error(made.error);let state=made.state;const prefixes=[state];
  for(const action of v5VictoryGuide){const next=v5Sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!next.ok)throw Error(next.error);state=next.state;prefixes.push(state);}guidePrefixes=prefixes;
 }
 const state=guidePrefixes.find(predicate);if(!state)throw Error('Required legal v5 storage boundary absent from published guide');
 const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);return checked.state;
}
export function storageStep(state:RunState,action:Action){
 const result=v5Sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});
 if(!result.ok)throw Error(`Rejected storage boundary action ${action.type}: ${result.error}`);
 const checked=v5Sdk.validateRun(result.state);if(!checked.ok)throw Error(checked.detail);return result;
}
function memoryStore(){const values=new Map<string,string>();return{values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}
export function runRaw(state:RunState,stamp=STAMP):string {
 const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);
 const host=memoryStore(),repository=v5Sdk.createV5SaveRepository(()=>host,()=>stamp);repository.load();const saved=repository.write(checked.state);if(!saved.ok)throw Error(saved.detail);
 return host.values.get(STORAGE_KEYS.run)!;
}
export function awards(state:RunState):CollectionState {const result=v5Sdk.collectionFromRun(state);if(!result.ok)throw Error(result.detail);return result.state;}
export function bookRaw(collection:CollectionState,stamp=STAMP):string {
 const checked=v5Sdk.validateCollection(collection);if(!checked.ok)throw Error(checked.detail);
 const host=memoryStore(),repository=v5Sdk.createCollectionRepository(()=>host,()=>stamp);repository.load();const saved=repository.write(checked.state);if(!saved.ok)throw Error(saved.detail);
 return host.values.get(STORAGE_KEYS.book)!;
}
export function fixtureRaw(state:RunState,collection=awards(state)){return{[STORAGE_KEYS.run]:runRaw(state),[STORAGE_KEYS.book]:bookRaw(collection)};}

/** Old-schema fixtures keep their own interpreter, source and receipts. */
export async function legacyFixture(complete=true){
 const sdk:typeof import('../../src/v4-sdk.js')=await import(pathToFileURL(resolve('dist/sword-led-v4.js')).href);
 const source=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8')) as import('../../src/core-v4/index.js').RunState;
 const checked=sdk.validateRun(source);if(!checked.ok)throw Error(checked.detail);
 let state=checked.state;
 if(!complete){const made=sdk.createRun({runId:source.runId,seed:source.seed,mode:source.mode,eligibility:source.initialEligibility});if(!made.ok)throw Error(made.error);state=made.state;for(const action of source.journal){if(state.day===4&&state.phase==='summary')break;const next=sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!next.ok)throw Error(next.error);state=next.state;}if(state.day!==4||state.phase!=='summary')throw Error('Required old first-chapter summary was absent');}
 const collection=sdk.collectionFromRun(state);if(!collection.ok)throw Error(collection.detail);
 const host=memoryStore(),repository=sdk.createV4SaveRepository(()=>host,()=>STAMP);repository.load();const saved=repository.write(state);if(!saved.ok)throw Error(saved.detail);
 const raw=JSON.stringify({schemaVersion:1,rulesVersion:'forge-v4-collection-v1',savedAt:STAMP,state:collection.state});
 const legacy=v5Sdk.decodeLegacyCollection(raw);if(legacy.status!=='valid')throw Error('Legacy source fixture did not decode');
 const converted=v5Sdk.collectionFromLegacy(legacy.state);if(!converted.ok)throw Error(converted.detail);
 return{raw,run:host.values.get('sword-led.save.v4')!,converted:converted.state,state};
}

/** Faults affect only test-owned Storage/Web Locks. The captured native getter observes disk, never feeds the product. */
export async function installStorageProbe(page:Page,initialRaw:Record<string,string|null>={},faults:Partial<StorageFaults>={}){
 await page.addInitScript(({initialRaw,faults,keys})=>{
  const host=window.localStorage,get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
  if(!sessionStorage.getItem('v5-storage-fixture')){for(const[key,value]of Object.entries(initialRaw)){if(value===null)remove.call(host,key);else set.call(host,key,value);}sessionStorage.setItem('v5-storage-fixture','once');}
  const probe:StorageProbe={faults:{read:faults.read??[],write:faults.write??[],denyGetter:faults.denyGetter??false,rejectLease:faults.rejectLease??false},writes:[],events:[],callbacks:{},raw:()=>Object.fromEntries(keys.map(key=>[key,get.call(host,key)]))};window.v5StorageProbe=probe;
  Storage.prototype.getItem=function(key){if(probe.faults.read.includes(key))throw new DOMException('Declared v5 read refusal','SecurityError');return get.call(this,key);};
  Storage.prototype.setItem=function(key,value){const accepted=!probe.faults.write.includes(key);if(keys.some(storedKey=>storedKey===key))probe.writes.push({key,value,accepted,operation:'set'});if(!accepted)throw new DOMException('Declared v5 write refusal','QuotaExceededError');return set.call(this,key,value);};
  Storage.prototype.removeItem=function(key){const accepted=!probe.faults.write.includes(key);if(keys.some(storedKey=>storedKey===key))probe.writes.push({key,value:null,accepted,operation:'remove'});if(!accepted)throw new DOMException('Declared v5 remove refusal','QuotaExceededError');return remove.call(this,key);};
  Storage.prototype.clear=function(){probe.writes.push({key:'*',value:null,accepted:true,operation:'clear'});return clear.call(this);};
  Object.defineProperty(window,'localStorage',{configurable:true,get(){if(probe.faults.denyGetter)throw new DOMException('Declared v5 getter refusal','SecurityError');return host;}});
  const locks=navigator.locks;
  if(locks)Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(...args:Parameters<LockManager['request']>)=>probe.faults.rejectLease?Promise.reject(new Error('Declared lease refusal')):locks.request(...args)}});
  window.addEventListener('storage',event=>probe.events.push({key:event.key,value:event.newValue,trusted:event.isTrusted}));
 },{initialRaw,faults,keys:[...ALL_STORAGE_KEYS]});
}
export async function storageFaults(page:Page,patch:Partial<StorageFaults>){await page.evaluate(patch=>Object.assign(window.v5StorageProbe.faults,patch),patch);}
export async function storageSnapshot(page:Page){return page.evaluate(()=>({raw:window.v5StorageProbe.raw(),writes:[...window.v5StorageProbe.writes],events:[...window.v5StorageProbe.events]}));}
export async function diskState(page:Page){const raw=(await storageSnapshot(page)).raw[STORAGE_KEYS.run];if(!raw)throw Error('No actual disk v5 run');const decoded=v5Sdk.decodeV5Save(raw);if(decoded.status!=='valid')throw Error('Disk state is not a valid run');return decoded.state;}
export async function saveDialog(page:Page){if(await page.locator('#v4-dialog').isVisible())await page.keyboard.press('Escape');await page.locator('#v4-save-open').click();await expect(page.locator('#v4-dialog-title')).toHaveText('把行程收好');}
export async function closeStorageDialog(page:Page){if(await page.locator('#v4-dialog').isVisible())await page.keyboard.press('Escape');await expect(page.locator('#v4-dialog')).not.toBeVisible();}
export async function exportMemory(page:Page,info:TestInfo,label:string){
 await saveDialog(page);const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前行程',exact:true}).click();const file=await waiting,path=info.outputPath(`${label}-actual-memory.json`);await file.saveAs(path);const decoded=v5Sdk.validateRun(JSON.parse(await readFile(path,'utf8')));if(!decoded.ok)throw Error(decoded.detail);return decoded.state;
}
export async function exportBook(page:Page,info:TestInfo,label:string){
 await saveDialog(page);const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'导出炉谱和原文',exact:true}).click();const file=await waiting,path=info.outputPath(`${label}-actual-book.json`);await file.saveAs(path);const bundle=JSON.parse(await readFile(path,'utf8')) as {format:string;collection:CollectionState;stored:unknown};expect(bundle.format).toBe('sword-led.collection-export.v2');const checked=v5Sdk.validateCollection(bundle.collection);if(!checked.ok)throw Error(checked.detail);return{...bundle,collection:checked.state};
}
export async function heldConfirmation(page:Page,name:string){await page.locator('#v4-dialog-actions').getByRole('button',{name:'确认',exact:true}).evaluate((button,name)=>{window.v5StorageProbe.callbacks[name]=()=>{(button as HTMLButtonElement).click();};},name);}
export async function invokeOldConfirmation(page:Page,name:string){await page.evaluate(name=>window.v5StorageProbe.callbacks[name]!(),name);}
export async function externalSlots(page:Page,updates:Record<string,string>){
 const other=await page.context().newPage();
 try{await other.goto(new URL('/assets/d/manifest.json',page.url()).href);await other.evaluate(updates=>{for(const[key,value]of Object.entries(updates))localStorage.setItem(key,value);},updates);await expect.poll(()=>page.evaluate(updates=>Object.entries(updates).every(([key,value])=>window.v5StorageProbe.events.some(event=>event.key===key&&event.value===value&&event.trusted)),updates)).toBe(true);}
 finally{await other.close();}
}
export async function storageResume(page:Page,info:TestInfo,state:RunState,collection=awards(state)){
 const driver=new KeyboardV5(page,info,'mouse');await driver.install();await installStorageProbe(page,fixtureRaw(state,collection));await page.goto('/');await expect(page.locator('#v4-continue')).toBeEnabled();await driver.activate(page.locator('#v4-continue'));expect((await driver.record('restored-legitimate-storage-boundary')).state).toEqual(state);await driver.leaveIntro();return driver;
}
export async function recordStorage(page:Page,info:TestInfo,label:string,state?:RunState,extra:Record<string,unknown>={}){
 const snapshot=await storageSnapshot(page);if(state){const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);}
 await writeFile(info.outputPath(`${label}-storage.json`),JSON.stringify({label,scope:'Restored legal boundary with actual UI/Storage faults; not a new complete campaign',state:state??null,...snapshot,...extra},null,2));return snapshot;
}
export async function storageScreens(page:Page,info:TestInfo,label:string){
 const dpr=Number(info.project.use.deviceScaleFactor??1),observations=[];
 for(const viewport of[{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>devicePixelRatio)).toBe(dpr);await page.screenshot({path:info.outputPath(`${label}-${viewport.width}.png`)});observations.push(await page.evaluate(()=>({dpr:devicePixelRatio,width:innerWidth,height:innerHeight,dialog:document.querySelector('#v4-dialog')?.textContent})));}
 await page.setViewportSize(info.project.use.viewport??{width:1280,height:720});await writeFile(info.outputPath(`${label}-geometry.json`),JSON.stringify(observations,null,2));
}
