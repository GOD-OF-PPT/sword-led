import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createRun,applyCommand,validateRun} from '../../src/core-v4/index.js';
import type {Action,RunState} from '../../src/core-v4/index.js';
import {createV4Session,createV4SaveRepository,decodeV4Save,V4_SAVE_KEY,V4_BACKUP_KEY} from '../../src/application/v4-persistence.js';
import type {V4Session} from '../../src/application/v4-persistence.js';
import {createCollectionRepository,collectionFromRun,validateCollection,mergeCollections,emptyCollection,collectionEligibility,decodeCollection,COLLECTION_KEY,COLLECTION_BACKUP_KEY} from '../../src/application/v4-collection.js';
import {createWriterLease} from '../../src/platform/writer-lease.js';
import {MemoryStorage,TestLocks,FIXED_TIME} from './persistence-fixtures.js';

// These are archived genuine command witnesses, not assigned wallet/phase fixtures.
const loadWitness=(name:string)=>JSON.parse(readFileSync(`docs/evidence/T11-4-2-3i1/witness-fixed/${name}.json`,'utf8')) as RunState;
const victory=loadWitness('complete'),returned=loadWitness('return'),failed=loadWitness('chapter-defeat');
function awards(s:RunState){const r=collectionFromRun(s);if(!r.ok)throw Error(r.detail);return r.state;}
const completeCollection=awards(victory),returnCollection=awards(returned),failedCollection=awards(failed);
function beforeChapter(){
 const c=createRun({runId:victory.runId,seed:victory.seed,mode:victory.mode,eligibility:victory.initialEligibility});if(!c.ok)throw Error(c.error);
 let s=c.state;
 for(const action of victory.journal){if(s.day===4&&action.type==='settle')return s;const r=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});if(!r.ok)throw Error(r.error);s=r.state;}
 throw Error('Missing actual chapter prefix');
}
const chapterPrefix=beforeChapter();
class Store extends MemoryStorage {
 readonly deniedReads=new Set<string>();readonly deniedWrites=new Set<string>();
 override getItem(k:string){if(this.deniedReads.has(k))throw Error('read denied');return super.getItem(k);}
 override setItem(k:string,v:string){if(this.deniedWrites.has(k))throw Error('quota denied');super.setItem(k,v);}
}
function open(store=new Store(),locks:TestLocks|undefined=new TestLocks()){
 return createV4Session(createV4SaveRepository(()=>store,()=>FIXED_TIME),createWriterLease(locks),createCollectionRepository(()=>store,()=>FIXED_TIME));
}
function stored(store:Store,state:RunState){expect(validateRun(state).ok).toBe(true);const repo=createV4SaveRepository(()=>store,()=>FIXED_TIME);repo.load();expect(repo.write(state).ok).toBe(true);}
const decide=(s:V4Session,confirmed=false)=>({generation:s.getSnapshot().generation,confirmed});
function send(s:V4Session,action:Action){const snap=s.getSnapshot();return s.dispatch({runId:snap.state!.runId,expectedRevision:snap.state!.revision,action},snap.generation);}
function collectionRaw(state=completeCollection){return JSON.stringify({schemaVersion:1,rulesVersion:'forge-v4-collection-v1',savedAt:FIXED_TIME,state});}

describe('v4 collection codec and deterministic sets',()=>{
 it('derives real achievements and receipts, never grants challenge on return or chapter defeat',()=>{
  expect(completeCollection.works).toHaveLength(12);expect(completeCollection.challenge).toBe(true);
  expect(returnCollection.challenge).toBe(false);expect(failedCollection.chapters).toEqual([1]);expect(collectionEligibility(failedCollection).recipes).toEqual(['light','guard']);
  expect(decodeCollection(collectionRaw())).toMatchObject({status:'valid',state:completeCollection});
  expect(collectionFromRun({...victory,coins:victory.coins+1}).ok).toBe(false);
 });
 it('merges real collections commutatively, associatively and idempotently without mutating callers',()=>{
  const a=structuredClone(completeCollection),b=returnCollection,c=failedCollection;
  expect(mergeCollections(a,b)).toEqual(mergeCollections(b,a));expect(mergeCollections(mergeCollections(a,b),c)).toEqual(mergeCollections(a,mergeCollections(b,c)));
  expect(mergeCollections(a,a)).toEqual(a);expect(mergeCollections(a,b).works).toHaveLength(12);expect(Object.isFrozen(a)).toBe(false);expect(Object.isFrozen(a.works)).toBe(false);
  const actual=mergeCollections(a,b).works.find(w=>w.commissionId===1)!;
  expect(actual.blades.reduce((n,p)=>n+p.value,0)).toBe(Math.max(a.works[0]!.blades.reduce((n,p)=>n+p.value,0),b.works[0]!.blades.reduce((n,p)=>n+p.value,0)));
 });
 it.each(['extra','duplicate','wrong-route','wrong-count','wrong-day','wrong-blade','below-target','chapter-gap','fake-challenge'])('rejects malformed %s collection without a claimed replay of receipts',kind=>{
  const v=structuredClone(completeCollection) as unknown as Record<string,unknown>;
  const works=v.works as {commissionId:number;day:number;routeId:string;blades:Record<string,unknown>[]}[];
  if(kind==='extra')v.coins=999;
  if(kind==='duplicate')works.push(works[0]!);
  if(kind==='wrong-route')works[0]!.routeId='unknown';
  if(kind==='wrong-count')works.find(w=>w.commissionId===8)!.blades.pop();
  if(kind==='wrong-day')works[0]!.day=9;
  if(kind==='wrong-blade')works[0]!.blades[0]!.status='sold';
  if(kind==='below-target')works[0]!.blades[0]!.value=1;
  if(kind==='chapter-gap')v.chapters=[2,3];
  if(kind==='fake-challenge')v.works=[];
  expect(validateCollection(v).ok).toBe(false);
 });
 it('rejects accessors, future envelopes and UTF8 overflow while preserving raw input',()=>{
  let invoked=false;expect(validateCollection({get chapters(){invoked=true;return[];}}).ok).toBe(false);expect(invoked).toBe(false);
  expect(decodeCollection(collectionRaw().replace('"schemaVersion":1','"schemaVersion":7'))).toMatchObject({status:'invalid',error:'unsupported_schema'});
  expect(decodeCollection('汉'.repeat(90_000))).toMatchObject({status:'invalid',error:'save_too_large'});
 });
});

describe('v4 session and separate durable collection',()=>{
 it('uses independent schema/key, rejects injected qualifications, and preserves every legacy byte',async()=>{
  const store=new Store();for(const k of ['save.v1','save.backup.v1','save.v2','save.backup.v2','save.v3','save.backup.v3'])store.data.set('sword-led.'+k,`original:${k}`);
  const old=new Map(store.data),s=open(store);await s.activate();
  expect(s.startNewGame({runId:'v4',seed:'one',eligibility:{recipes:['heavy'],challenge:true}} as never,decide(s))).toMatchObject({ok:false,error:'invalid_command'});
  expect(s.startNewGame({runId:'v4',seed:'one',mode:'challenge'},decide(s))).toMatchObject({ok:false,error:'challenge_locked'});
  expect(s.startNewGame({runId:'v4',seed:'one'},decide(s)).ok).toBe(true);expect(send(s,{type:'continue'}).ok).toBe(true);
  expect(send(s,{type:'strike',pieceId:'d1-1'}).ok).toBe(true);expect(JSON.parse(store.getItem(V4_SAVE_KEY)!).schemaVersion).toBe(4);
  expect(decodeV4Save(store.getItem(V4_SAVE_KEY))).toMatchObject({status:'valid',state:s.getSnapshot().state});
  for(const [k,v]of old)expect(store.getItem(k)).toBe(v);expect(store.getItem(COLLECTION_KEY)).toBeNull();await s.dispose();
 });
 it('restores a genuine return ending and permits new story without treating return as ongoing',async()=>{
  const store=new Store();stored(store,returned);const s=open(store);await s.activate();expect(s.getSnapshot().state).toEqual(returned);
  expect(s.getCollectionSnapshot().data.challenge).toBe(false);expect(s.startNewGame({runId:'again',seed:'again'},decide(s)).ok).toBe(true);
  expect(s.getSnapshot().state!.initialEligibility).toEqual({recipes:['light','guard','heavy'],challenge:false});await s.dispose();
 });
 it('does not credit an accepted unsaved chapter, and protects its missing awards until exact retry succeeds',async()=>{
  const store=new Store();stored(store,chapterPrefix);const s=open(store);await s.activate();store.deniedWrites.add(V4_SAVE_KEY);const writes=store.writes.length;
  expect(send(s,{type:'settle'})).toMatchObject({ok:true,persistence:{ok:false}});const accepted=s.getSnapshot().state;
  expect(s.getSnapshot().dirty).toBe(true);expect(s.getCollectionSnapshot().data.chapters).toEqual([]);
  expect(store.writes.slice(writes)).not.toContain(COLLECTION_KEY);
  expect(s.startNewGame({runId:'do-not-lose',seed:'x'},decide(s,true))).toMatchObject({ok:false,error:'collection_pending'});
  store.deniedWrites.delete(V4_SAVE_KEY);expect(s.retrySave(s.getSnapshot().generation).ok).toBe(true);
  expect(s.getSnapshot().state).toBe(accepted);expect(s.getCollectionSnapshot().data.chapters).toEqual([1]);expect(s.getCollectionSnapshot().pending).toBe(false);await s.dispose();
 });
 it('keeps accepted run saved when only collection fails; export, reload and retries never issue commands',async()=>{
  const store=new Store();stored(store,chapterPrefix);const s=open(store);await s.activate();store.deniedWrites.add(COLLECTION_KEY);
  expect(send(s,{type:'settle'})).toMatchObject({ok:true,persistence:{ok:true}});const exact=s.getSnapshot().state!;expect(s.getSnapshot().dirty).toBe(false);
  expect(s.getCollectionSnapshot()).toMatchObject({pending:true,lastSave:{ok:false,error:'storage_write_failed'}});
  const raw=store.getItem(V4_SAVE_KEY),writes=store.writes.length;
  expect(JSON.parse(s.exportRun()!)).toEqual(exact);expect(JSON.parse(s.exportCollection()).collection.chapters).toEqual([1]);expect(store.writes).toHaveLength(writes);
  expect(s.startNewGame({runId:'blocked',seed:'x'},decide(s,true))).toMatchObject({ok:false,error:'collection_pending'});expect(store.getItem(V4_SAVE_KEY)).toBe(raw);
  await s.dispose();store.deniedWrites.delete(COLLECTION_KEY);const restored=open(store);await restored.activate();expect(restored.getSnapshot().state).toEqual(exact);
  expect(restored.getCollectionSnapshot().data.chapters).toEqual([1]);const revision=restored.getSnapshot().state!.revision,after=store.writes.length;
  expect(restored.retryCollection(restored.getSnapshot().generation).ok).toBe(true);expect(restored.retryCollection(restored.getSnapshot().generation).ok).toBe(true);
  expect(store.writes).toHaveLength(after);expect(restored.getSnapshot().state!.revision).toBe(revision);await restored.dispose();
 });
 it('reports backup write warnings separately while keeping the new primary collection',async()=>{
  const store=new Store();stored(store,chapterPrefix);const s=open(store);await s.activate();store.deniedWrites.add(COLLECTION_BACKUP_KEY);send(s,{type:'settle'});
  expect(s.getCollectionSnapshot()).toMatchObject({pending:false,lastSave:{ok:true,backupWarning:true}});expect(decodeCollection(store.getItem(COLLECTION_KEY))).toMatchObject({status:'valid',state:s.getCollectionSnapshot().data});await s.dispose();
 });
 it('preserves a future collection and exports exact raw bytes; recovery is explicit and merges legal current awards',async()=>{
  const store=new Store(),future=collectionRaw().replace('"schemaVersion":1','"schemaVersion":9');stored(store,failed);store.data.set(COLLECTION_KEY,future);store.data.set(COLLECTION_BACKUP_KEY,collectionRaw(failedCollection));const s=open(store);await s.activate();
  expect(store.getItem(COLLECTION_KEY)).toBe(future);expect(s.getCollectionSnapshot().problem).toBe('unsupported_schema');expect(JSON.parse(s.exportCollection()).stored.main.raw).toBe(future);
  expect(s.recoverCollectionBackup(decide(s))).toMatchObject({ok:false,error:'confirmation_required'});expect(s.recoverCollectionBackup(decide(s,true)).ok).toBe(true);
  expect(s.getCollectionSnapshot().data.chapters).toEqual([1]);expect(s.recoverCollectionBackup(decide(s,true))).toMatchObject({ok:false,error:'main_available'});await s.dispose();
 });
 it.each(['valid','unavailable','future'])('does not auto-write an empty main over a %s backup recovery path',async kind=>{
  const store=new Store();stored(store,failed);if(kind==='unavailable')store.deniedReads.add(COLLECTION_BACKUP_KEY);else store.data.set(COLLECTION_BACKUP_KEY,kind==='valid'?collectionRaw(failedCollection):collectionRaw().replace('"schemaVersion":1','"schemaVersion":2'));
  const s=open(store);await s.activate();expect(store.getItem(COLLECTION_KEY)).toBeNull();expect(s.getCollectionSnapshot().problem).not.toBeNull();await s.dispose();
 });
 it('keeps core eligibility frozen after external profile changes, and never adopts the change as a run conflict',async()=>{
  const store=new Store();const s=open(store);await s.activate();s.startNewGame({runId:'fixed',seed:'fixed'},decide(s));const before=s.getSnapshot().state;
  store.data.set(COLLECTION_KEY,collectionRaw());s.notifyCollectionChange();expect(s.getSnapshot().conflict).toBe(false);expect(s.getSnapshot().state).toBe(before);
  expect(before!.initialEligibility.recipes).toEqual(['light']);expect(s.getCollectionSnapshot().data.challenge).toBe(true);expect(validateRun(s.getSnapshot().state).ok).toBe(true);await s.dispose();
 });
 it('uses one shared lease, blocks stale input, merges external collections on reacquisition, and leaves memory unsaved',async()=>{
  const store=new Store(),locks=new TestLocks();stored(store,failed);const a=open(store,locks),b=open(store,locks);await a.activate();expect((await b.activate()).mode).toBe('readonly');
  const old=a.getSnapshot().generation;await a.suspend();await b.activate();store.data.set(COLLECTION_KEY,collectionRaw(returnCollection));b.notifyCollectionChange();await b.suspend();await a.activate();
  expect(a.getCollectionSnapshot().data.works.length).toBeGreaterThanOrEqual(11);expect(a.dispatch({runId:failed.runId,expectedRevision:failed.revision,action:{type:'settle'}},old)).toMatchObject({ok:false,error:'stale_session'});
  expect(locks.requests.every(r=>r.name==='sword-led.writer')).toBe(true);await a.dispose();await b.dispose();
  const memory=open(store,undefined);await memory.activate();expect(memory.useMemory({runId:'memory',seed:'memory'},decide(memory,true)).ok).toBe(true);const writes=store.writes.length;send(memory,{type:'continue'});send(memory,{type:'strike',pieceId:'d1-1'});expect(store.writes).toHaveLength(writes);await memory.dispose();
 });
 it('prevents listener reentry before collection synchronization and publishes lifecycle changes to all listeners',async()=>{
  const store=new Store();stored(store,chapterPrefix);const s=open(store);await s.activate();let nested:unknown;let ready=false;const modes:string[]=[];
  s.subscribe(snap=>{if(ready&&snap.state?.phase==='chapter'){nested=s.startNewGame({runId:'nested',seed:'nested'},{generation:snap.generation,confirmed:true});void s.suspend();}});
  s.subscribe(snap=>{modes.push(snap.mode);});ready=true;send(s,{type:'settle'});
  expect(nested).toMatchObject({ok:false,error:'session_busy'});expect(s.getSnapshot().state!.phase).toBe('chapter');expect(s.getCollectionSnapshot().data.chapters).toEqual([1]);expect(modes.at(-1)).toBe('inactive');await s.dispose();
 });
 it('cancels activate followed immediately by suspend/dispose without late permanent writes',async()=>{
  const store=new Store();stored(store,victory);const s=open(store);const before=store.writes.length,pending=s.activate();await s.suspend();await s.dispose();await pending;
  expect(s.getSnapshot().mode).toBe('disposed');expect(store.writes).toHaveLength(before);expect(s.retryCollection(s.getSnapshot().generation)).toMatchObject({ok:false,error:'disposed'});
 });
 it('requires explicit backup recovery, preserves accepted randomness and ignores stale generations afterward',async()=>{
  const store=new Store();const s=open(store);await s.activate();s.startNewGame({runId:'backup',seed:'backup'},decide(s));send(s,{type:'continue'});send(s,{type:'strike',pieceId:'d1-1'});
  const before=s.getSnapshot(),backup=decodeV4Save(store.getItem(V4_BACKUP_KEY));expect(backup.status).toBe('valid');store.data.set(V4_SAVE_KEY,'broken');s.notifyExternalChange();
  expect(s.recoverBackup(decide(s))).toMatchObject({ok:false,error:'confirmation_required'});expect(s.recoverBackup(decide(s,true)).ok).toBe(true);
  if(backup.status==='valid')expect(s.getSnapshot().state).toEqual(backup.state);expect(s.dispatch({},before.generation)).toMatchObject({ok:false,error:'stale_session'});await s.dispose();
 });
});
