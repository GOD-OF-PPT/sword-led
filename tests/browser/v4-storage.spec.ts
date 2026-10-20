import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRun,applyCommand,validateRun} from '../../src/core-v4/index.js';
import type {Action,RunState} from '../../src/core-v4/index.js';
import {collectionFromRun} from '../../src/application/v4-collection.js';
import type {V4Session} from '../../src/application/v4-persistence.js';

declare global {interface Window {v4Test:{sdk:typeof import('../../src/v4-sdk.js');session:V4Session}}}
const witness=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8')) as RunState;
const made=createRun({runId:witness.runId,seed:witness.seed});if(!made.ok)throw Error(made.error);
let cursor=made.state,prefix:Action[]=[];
for(const action of witness.journal){if(cursor.day===4&&action.type==='settle')break;prefix.push(action);const r=applyCommand(cursor,{runId:cursor.runId,expectedRevision:cursor.revision,action});if(!r.ok)throw Error(r.error);cursor=r.state;}
const expectedCollection=collectionFromRun(witness);if(!expectedCollection.ok)throw Error(expectedCollection.detail);
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});
async function boot(page:Page){
 await page.goto('/tests/browser/fixture.html');await page.evaluate(()=>window.storageTest.ready);
 return page.evaluate(async()=>{await window.storageTest.session.dispose();const path='/dist/sword-led-v4.js',sdk=await import(path) as typeof import('../../src/v4-sdk.js');const session=sdk.createV4BrowserSession(window);window.v4Test={sdk,session};return session.activate();});
}
async function start(page:Page){expect(await page.evaluate(({runId,seed})=>{const s=window.v4Test.session;return s.startNewGame({runId,seed},{generation:s.getSnapshot().generation,confirmed:false}).ok;},{runId:witness.runId,seed:witness.seed})).toBe(true);}
async function actions(page:Page,list:readonly Action[]){
 return page.evaluate(list=>{const s=window.v4Test.session;for(const action of list){const snap=s.getSnapshot(),state=snap.state!;const r=s.dispatch({runId:state.runId,expectedRevision:state.revision,action},snap.generation);if(!r.ok)throw Error(r.error);}return s.getSnapshot();},list);
}

test('actual twelve-day SDK campaign saves chapters, reloads exact progress, then unlocks a frozen challenge',async({page},info)=>{
 await boot(page);await start(page);
 const result=await page.evaluate(async list=>{
  const {sdk}=window.v4Test;let s=window.v4Test.session;const chapterStates:RunState[]=[];
  for(const action of list){const snap=s.getSnapshot(),state=snap.state!,r=s.dispatch({runId:state.runId,expectedRevision:state.revision,action},snap.generation);if(!r.ok||!r.persistence?.ok)throw Error(r.ok?'Save failed':r.error);
   if(action.type==='settle'&&[4,8,12].includes(r.state.day)){const exact=JSON.stringify(r.state);chapterStates.push(r.state);await s.dispose();s=sdk.createV4BrowserSession(window);window.v4Test.session=s;await s.activate();if(JSON.stringify(s.getSnapshot().state)!==exact)throw Error('Reload changed chapter');}
  }
  const state=s.getSnapshot().state,collection=s.getCollectionSnapshot(),raw=localStorage.getItem(sdk.V4_SAVE_KEY);
  return {state,collection,chapterStates,raw};
 },witness.journal);
 expect(result.state).toEqual(witness);expect(result.collection.data).toEqual(expectedCollection.state);expect(result.collection.pending).toBe(false);
 await page.reload();await boot(page);expect(await page.evaluate(()=>window.v4Test.session.getSnapshot().state)).toEqual(witness);
 const challenge=await page.evaluate(()=>{const s=window.v4Test.session,r=s.startNewGame({runId:'browser-challenge',seed:'browser-challenge',mode:'challenge'},{generation:s.getSnapshot().generation,confirmed:false});return{ok:r.ok,state:s.getSnapshot().state,collection:s.getCollectionSnapshot().data};});
 expect(challenge.ok).toBe(true);expect(challenge.state!.initialEligibility).toEqual({recipes:['light','guard','heavy'],challenge:true});expect(validateRun(challenge.state).ok).toBe(true);
 await info.attach('real-v4-campaign',{body:JSON.stringify({...result,challenge},null,2),contentType:'application/json'});
});

test('combined run and profile write failures preserve accepted chapter, exact RNG, exports and protected restart',async({page},info)=>{
 await boot(page);await start(page);await actions(page,prefix);
 const result=await page.evaluate(async()=>{
  const {session:s,sdk}=window.v4Test,original=Storage.prototype.setItem;
  let runDenied=true,profileDenied=false;
  Storage.prototype.setItem=function(k,v){if(k===sdk.V4_SAVE_KEY&&runDenied||k===sdk.COLLECTION_KEY&&profileDenied)throw new DOMException('Test quota','QuotaExceededError');return original.call(this,k,v);};
  const snap=s.getSnapshot(),state=snap.state!,accepted=s.dispatch({runId:state.runId,expectedRevision:state.revision,action:{type:'settle'}},snap.generation);
  const unsaved=s.getSnapshot(),notCredited=s.getCollectionSnapshot(),blocked=s.startNewGame({runId:'cannot-erase',seed:'cannot-erase'},{generation:unsaved.generation,confirmed:true});
  runDenied=false;profileDenied=true;const retried=s.retrySave(s.getSnapshot().generation),runSaved=s.getSnapshot(),profileFailed=s.getCollectionSnapshot();
  const beforeExport=localStorage.getItem(sdk.V4_SAVE_KEY),exported=s.exportRun(),collectionExport=s.exportCollection();
  const still=s.startNewGame({runId:'still-protected',seed:'still-protected'},{generation:s.getSnapshot().generation,confirmed:true});
  profileDenied=false;const repaired=s.retryCollection(s.getSnapshot().generation),final=s.getSnapshot(),profile=s.getCollectionSnapshot(),afterExport=localStorage.getItem(sdk.V4_SAVE_KEY);Storage.prototype.setItem=original;
  await s.dispose();const restored=sdk.createV4BrowserSession(window);window.v4Test.session=restored;await restored.activate();
  return{accepted,unsaved,notCredited,blocked,retried,runSaved,profileFailed,still,repaired,final,profile,exported,collectionExport,unchangedRun:beforeExport===afterExport,restored:restored.getSnapshot()};
 });
 expect(result.accepted).toMatchObject({ok:true,persistence:{ok:false}});expect(result.notCredited.data.chapters).toEqual([]);expect(result.notCredited).toMatchObject({pending:true,problem:'run_unsaved'});
 expect(result.blocked).toMatchObject({ok:false,error:'collection_pending'});expect(result.retried.ok).toBe(true);expect(result.runSaved.dirty).toBe(false);expect(result.profileFailed).toMatchObject({pending:true,lastSave:{ok:false}});expect(result.still).toMatchObject({ok:false,error:'collection_pending'});
 expect(result.repaired.ok).toBe(true);expect(result.profile.data.chapters).toEqual([1]);expect(result.final.state).toEqual(result.unsaved.state);expect(result.restored.state).toEqual(result.final.state);expect(result.unchangedRun).toBe(true);expect(JSON.parse(result.exported!)).toEqual(result.final.state);
 await info.attach('real-v4-faults',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});

test('future and unreadable-backup profile bytes remain protected until explicit legal recovery',async({page},info)=>{
 await boot(page);await start(page);await actions(page,[...prefix,{type:'settle'}]);
 const result=await page.evaluate(()=>{
  const {session:s,sdk}=window.v4Test,valid=localStorage.getItem(sdk.COLLECTION_KEY)!,future=JSON.stringify({...JSON.parse(valid),schemaVersion:9});
  localStorage.setItem(sdk.COLLECTION_BACKUP_KEY,valid);localStorage.setItem(sdk.COLLECTION_KEY,future);s.notifyCollectionChange();const runBytes=localStorage.getItem(sdk.V4_SAVE_KEY),before=s.getCollectionSnapshot(),exported=s.exportCollection(),cancel=s.recoverCollectionBackup({generation:s.getSnapshot().generation,confirmed:false}),kept=localStorage.getItem(sdk.COLLECTION_KEY)===future;
  const restored=s.recoverCollectionBackup({generation:s.getSnapshot().generation,confirmed:true});
  localStorage.removeItem(sdk.COLLECTION_KEY);const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===sdk.COLLECTION_BACKUP_KEY)throw new DOMException('Test read denied','SecurityError');return get.call(this,k);};
  s.notifyCollectionChange();const denied=s.getCollectionSnapshot(),mainKeptEmpty=get.call(localStorage,sdk.COLLECTION_KEY)===null;Storage.prototype.getItem=get;
  const recovered=s.recoverCollectionBackup({generation:s.getSnapshot().generation,confirmed:true});
  return{before,exported,cancel,kept,restored,denied,mainKeptEmpty,recovered,collection:s.getCollectionSnapshot(),state:s.getSnapshot().state,runUnchanged:localStorage.getItem(sdk.V4_SAVE_KEY)===runBytes};
 });
 expect(result.before.problem).toBe('unsupported_schema');expect(result.cancel).toMatchObject({ok:false,error:'confirmation_required'});expect(result.kept).toBe(true);expect(result.restored.ok).toBe(true);expect(result.denied.problem).toBe('storage_read_failed');expect(result.mainKeptEmpty).toBe(true);expect(result.recovered.ok).toBe(true);expect(result.collection.data.chapters).toEqual([1]);expect(result.runUnchanged).toBe(true);
 await info.attach('real-v4-recovery',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});

test('actual v3 and v4 windows share one writer, preserve old save and hand off without stale input',async({page,context})=>{
 await page.goto('/tests/browser/fixture.html');await page.evaluate(()=>window.storageTest.ready);
 const oldBytes=await page.evaluate(async()=>{await window.storageTest.session.dispose();const path='/dist/sword-led-v3.js',sdk=await import(path);const old=sdk.createV3BrowserSession(window);await old.activate();old.startNewGame({runId:'legacy-kept',seed:'legacy-kept',roundLimit:3},{generation:old.getSnapshot().generation,confirmed:false});const bytes=localStorage.getItem(sdk.V3_SAVE_KEY);await old.dispose();return bytes;});
 await boot(page);await start(page);await actions(page,[...prefix,{type:'settle'}]);const initial=await page.evaluate(()=>window.v4Test.session.getSnapshot());
 const other=await context.newPage();const second=await boot(other);expect(second.mode).toBe('readonly');
 expect(await other.evaluate(()=>{const s=window.v4Test.session;return s.startNewGame({runId:'readonly',seed:'readonly'},{generation:s.getSnapshot().generation,confirmed:true});})).toMatchObject({ok:false,error:'readonly'});
 const profileBefore=await page.evaluate(()=>window.v4Test.session.getSnapshot());
 await other.evaluate(()=>{const k=window.v4Test.sdk.COLLECTION_KEY;localStorage.setItem(k,localStorage.getItem(k)+' ');});
 await expect.poll(()=>page.evaluate(()=>window.v4Test.session.getCollectionSnapshot().pending)).toBe(false);expect(await page.evaluate(()=>window.v4Test.session.getSnapshot().conflict)).toBe(false);expect((await page.evaluate(()=>window.v4Test.session.getSnapshot())).state).toEqual(profileBefore.state);
 await page.evaluate(()=>window.v4Test.session.suspend());expect((await other.evaluate(()=>window.v4Test.session.activate())).mode).toBe('writer');await actions(other,[{type:'chooseModification',modification:'windbox'},{type:'advance'}]);const latest=await other.evaluate(()=>window.v4Test.session.getSnapshot().state);await other.evaluate(()=>window.v4Test.session.dispose());
 expect((await page.evaluate(()=>window.v4Test.session.activate())).mode).toBe('writer');expect(await page.evaluate(()=>window.v4Test.session.getSnapshot().state)).toEqual(latest);
 expect(await page.evaluate(generation=>window.v4Test.session.dispatch({},generation),initial.generation)).toMatchObject({ok:false,error:'stale_session'});
 expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(oldBytes);await other.close();
});

test('missing native locks permits explicit memory campaign without either slot or profile writes',async({page},info)=>{
 await page.goto('/tests/browser/fixture.html');await page.evaluate(()=>window.storageTest.ready);
 const result=await page.evaluate(async({input,list})=>{
  await window.storageTest.session.dispose();Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});const path='/dist/sword-led-v4.js',sdk=await import(path) as typeof import('../../src/v4-sdk.js'),session=sdk.createV4BrowserSession(window);window.v4Test={sdk,session};const unsupported=await session.activate();const started=session.useMemory(input,{generation:unsupported.generation,confirmed:false});if(!started.ok)throw Error(started.error);
  for(const action of list){const snap=session.getSnapshot(),state=snap.state!,r=session.dispatch({runId:state.runId,expectedRevision:state.revision,action},snap.generation);if(!r.ok)throw Error(r.error);}
  return{unsupported:unsupported.mode,state:session.getSnapshot().state,collection:session.getCollectionSnapshot(),slots:[sdk.V4_SAVE_KEY,sdk.V4_BACKUP_KEY,sdk.COLLECTION_KEY,sdk.COLLECTION_BACKUP_KEY].map(k=>localStorage.getItem(k))};
 },{input:{runId:witness.runId,seed:witness.seed},list:witness.journal});
 expect(result.unsupported).toBe('unsupported');expect(result.state).toEqual(witness);expect(result.collection.data.chapters).toEqual([]);expect(result.slots).toEqual([null,null,null,null]);await info.attach('real-v4-memory',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});
