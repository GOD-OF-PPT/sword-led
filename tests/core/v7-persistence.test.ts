import {describe,expect,it} from 'vitest';
import {applyCommand,validateRun} from '../../src/core-v7/index.js';
import type {Action,RunState} from '../../src/core-v7/index.js';
import {createV7Session,createV7SaveRepository,createV7WriterLease,decodeV7Save,V7_SAVE_KEY,V7_BACKUP_KEY,V7_WRITER_LOCK} from '../../src/application/v7-persistence.js';
import type {V7Session,V7SessionResult} from '../../src/application/v7-persistence.js';
import {createV6Session,createV6SaveRepository,createV6WriterLease,V6_WRITER_LOCK} from '../../src/application/v6-persistence.js';
import type {LockHost} from '../../src/platform/writer-lease.js';
import {FIXED_TIME,MemoryStorage,TestLocks} from './persistence-fixtures.js';
import {run,plainRoute} from './v7-routes.js';

// Legitimate stored states come only from public campaign commands and the
// formal repository. Edited JSON below is explicitly a rejected input.
class Store extends MemoryStorage {
 readonly deniedWrites=new Set<string>();
 override setItem(key:string,value:string){
  if(this.deniedWrites.has(key))throw Error('Declared storage write refusal');
  super.setItem(key,value);
 }
}
class NamedLocks implements LockHost {
 readonly byName=new Map<string,TestLocks>();
 readonly requests:string[]=[];
 request(name:string,options:{mode:'exclusive';ifAvailable:true},callback:(lock:object|null)=>Promise<void>){
  this.requests.push(name);let locks=this.byName.get(name);
  if(!locks){locks=new TestLocks();this.byName.set(name,locks);}
  return locks.request(name,options,callback);
 }
}
const open=(store=new Store(),locks:LockHost=new TestLocks())=>
 createV7Session(createV7SaveRepository(()=>store,()=>FIXED_TIME),createV7WriterLease(locks));
const decision=(session:V7Session,confirmed=false)=>({generation:session.getSnapshot().generation,confirmed});
function current(session:V7Session){
 const state=session.getSnapshot().state;if(!state)throw Error('Missing real v7 journey');return state;
}
function send(session:V7Session,action:Action){
 const snapshot=session.getSnapshot(),state=current(session);
 const command={runId:state.runId,expectedRevision:state.revision,action},oracle=applyCommand(state,command);
 if(!oracle.ok)throw Error('Invalid scenario command: '+oracle.error);
 const result=session.dispatch(command,snapshot.generation);
 if(!result.ok)throw Error('Session rejected legal command: '+result.error);
 expect(result.state).toEqual(oracle.state);expect(result.events).toEqual(oracle.events);
 expect(current(session)).toEqual(oracle.state);return result;
}
function rawFor(state:RunState){
 const store=new Store(),repository=createV7SaveRepository(()=>store,()=>FIXED_TIME);
 repository.load();expect(repository.write(state).ok).toBe(true);
 const raw=store.getItem(V7_SAVE_KEY);if(raw===null)throw Error('Formal v7 codec did not write');return raw;
}

describe('v7 independent persistent full campaign',()=>{
 it('keeps schema7 slots and the single v7 writer independent of every older save and the v6 writer',async()=>{
  const store=new Store(),locks=new NamedLocks();
  for(const version of [1,2,3,4,5,6])for(const slot of ['save','save.backup'])store.data.set(`sword-led.${slot}.v${version}`,`original ${slot} v${version}`);
  for(const key of ['sword-led.collection.v1','sword-led.collection.backup.v1','sword-led.collection.v2','sword-led.collection.backup.v2','sword-led.settings.v1'])store.data.set(key,'original '+key);
  const originals=new Map(store.data),old=createV6Session(createV6SaveRepository(()=>store,()=>FIXED_TIME),createV6WriterLease(locks));
  const first=open(store,locks),second=open(store,locks);
  try{
   expect((await old.activate()).mode).toBe('writer');expect((await first.activate()).mode).toBe('writer');
   expect(first.startNewGame({runId:'v7-independent',seed:'lantern'},decision(first)).ok).toBe(true);
   const exact=current(first),raw=store.getItem(V7_SAVE_KEY)!;
   expect(JSON.parse(raw)).toMatchObject({schemaVersion:7,rulesVersion:'forge-v7',savedAt:FIXED_TIME});
   expect(decodeV7Save(raw)).toMatchObject({status:'valid',state:exact});
   const wrong=JSON.parse(raw);wrong.schemaVersion=6;wrong.rulesVersion='forge-v6';
   expect(decodeV7Save(JSON.stringify(wrong))).toMatchObject({status:'invalid',error:'unsupported_schema'});
   expect((await second.activate()).mode).toBe('readonly');expect(current(second)).toEqual(exact);
   const readonly=second.getSnapshot();
   expect(second.dispatch({runId:exact.runId,expectedRevision:exact.revision,action:{type:'beginForge'}},readonly.generation)).toMatchObject({ok:false,error:'readonly'});
   const stale=first.getSnapshot();await first.suspend();expect((await second.activate()).mode).toBe('writer');
   expect(first.retrySave(stale.generation)).toMatchObject({ok:false,error:'stale_session'});
   expect(second.dispatch({runId:exact.runId,expectedRevision:exact.revision,action:{type:'beginForge'}},readonly.generation)).toMatchObject({ok:false,error:'stale_session'});
   expect(V7_WRITER_LOCK).not.toBe(V6_WRITER_LOCK);expect(locks.requests).toContain(V6_WRITER_LOCK);
   expect(locks.requests.filter(name=>name===V7_WRITER_LOCK)).toHaveLength(3);
   for(const[key,value]of originals)expect(store.getItem(key)).toBe(value);
   expect(store.writes.every(key=>key===V7_SAVE_KEY||key===V7_BACKUP_KEY)).toBe(true);
  }finally{await first.dispose();await second.dispose();await old.dispose();}
 });

 it('restores the complete campaign state and recovers the exact validated previous main only after confirmation',async()=>{
  const{r}=plainRoute(),prefix=r.state,store=new Store();store.data.set(V7_SAVE_KEY,rawFor(prefix));
  const first=open(store);
  try{
   await first.activate();expect(current(first)).toEqual(prefix);expect(Object.isFrozen(current(first))).toBe(true);
   send(first,{type:'depart'});const exact=current(first);
   expect(exact).toMatchObject({node:9,phase:'encounter',handId:prefix.handId,tool:prefix.tool,flags:prefix.flags,checkpoint:prefix.checkpoint});
   expect(decodeV7Save(store.getItem(V7_SAVE_KEY))).toMatchObject({status:'valid',state:exact});
   expect(decodeV7Save(store.getItem(V7_BACKUP_KEY))).toMatchObject({status:'valid',state:prefix});
   const forged=JSON.parse(store.getItem(V7_SAVE_KEY)!);forged.state.flags.coreOwner='player';
   expect(decodeV7Save(JSON.stringify(forged))).toMatchObject({status:'invalid',error:'invalid_state'});
   await first.suspend();const reloaded=open(store);
   try{await reloaded.activate();expect(current(reloaded)).toEqual(exact);}finally{await reloaded.dispose();}
  }finally{await first.dispose();}
  const corrupt='{broken current journey';store.data.set(V7_SAVE_KEY,corrupt);const recover=open(store);
  try{
   await recover.activate();const writes=store.writes.length,generation=recover.getSnapshot().generation;
   expect(recover.getSnapshot().load?.backup).toMatchObject({status:'valid',state:prefix});
   expect(recover.recoverBackup(decision(recover))).toMatchObject({ok:false,error:'confirmation_required'});
   expect(store.getItem(V7_SAVE_KEY)).toBe(corrupt);expect(store.writes).toHaveLength(writes);
   expect(recover.recoverBackup(decision(recover,true)).ok).toBe(true);expect(current(recover)).toEqual(prefix);
   expect(decodeV7Save(store.getItem(V7_SAVE_KEY))).toMatchObject({status:'valid',state:prefix});
   expect(recover.getSnapshot().generation).toBeGreaterThan(generation);
   expect(recover.recoverBackup(decision(recover,true))).toMatchObject({ok:false,error:'main_available'});
  }finally{await recover.dispose();}
 });

 it('retains and exports an Accepted random result through failed saving, reentrant listeners and save-only retry',async()=>{
  const store=new Store(),session=open(store);
  try{
   await session.activate();expect(session.startNewGame({runId:'v7-dirty',seed:'lantern'},decision(session)).ok).toBe(true);
   send(session,{type:'beginForge'});const before=current(session),disk=store.getItem(V7_SAVE_KEY);
   const attempts:V7SessionResult[]=[],stop=session.subscribe(snapshot=>{
    attempts.push(session.startNewGame({runId:'listener-replacement',seed:'other'}, {generation:snapshot.generation,confirmed:true}));
    void session.dispose();
   });
   store.deniedWrites.add(V7_SAVE_KEY);
   const accepted=send(session,{type:'forge',weaponId:before.forgeId!,kind:'ordinary'}),exact=current(session);
   expect(accepted).toMatchObject({ok:true,persistence:{ok:false,error:'storage_write_failed'}});
   expect(session.getSnapshot()).toMatchObject({mode:'writer',dirty:true,conflict:false});
   expect(store.getItem(V7_SAVE_KEY)).toBe(disk);expect(decodeV7Save(store.getItem(V7_BACKUP_KEY))).toMatchObject({status:'valid',state:before});
   expect(JSON.parse(session.exportRun()!)).toEqual(exact);expect(validateRun(JSON.parse(session.exportRun()!))).toMatchObject({ok:true,state:exact});
   expect(attempts.length).toBeGreaterThanOrEqual(2);expect(attempts.every(result=>!result.ok&&result.error==='session_busy')).toBe(true);
   expect(session.retrySave(session.getSnapshot().generation).ok).toBe(false);expect(current(session)).toBe(exact);
   store.deniedWrites.clear();expect(session.retrySave(session.getSnapshot().generation).ok).toBe(true);
   expect(current(session)).toBe(exact);expect(session.getSnapshot().dirty).toBe(false);
   expect(decodeV7Save(store.getItem(V7_SAVE_KEY))).toMatchObject({status:'valid',state:exact});
   stop();const saved=new Map(store.data),writes=store.writes.length;
   expect(session.useMemory(null,decision(session,true)).ok).toBe(true);
   send(session,{type:'forge',weaponId:exact.forgeId!,kind:'ordinary'});
   expect(JSON.parse(session.exportRun()!)).toEqual(current(session));expect(store.data).toEqual(saved);expect(store.writes).toHaveLength(writes);
  }finally{await session.dispose();}
 });

 it('lets ending and retryable failure records cancel a new journey without replacing progress or inheriting it on confirmation',async()=>{
  const ended=plainRoute().r;ended.act({type:'evacuate'});
  const failed=run('failed');failed.act({type:'depart'});for(let i=0;i<3;i++)failed.act({type:'endRound'});
  for(const prior of [ended.state,failed.state]){
   const store=new Store(),raw=rawFor(prior);store.data.set(V7_SAVE_KEY,raw);const session=open(store);
   try{
    await session.activate();const exact=current(session),snapshot=session.getSnapshot(),writes=store.writes.length;
    const input={runId:'fresh-'+prior.phase,seed:'fresh-seed'};
    for(let cancellation=0;cancellation<2;cancellation++){
     expect(session.startNewGame(input,decision(session))).toMatchObject({ok:false,error:'confirmation_required'});
     expect(current(session)).toBe(exact);expect(session.getSnapshot().generation).toBe(snapshot.generation);
     expect(store.getItem(V7_SAVE_KEY)).toBe(raw);expect(store.writes).toHaveLength(writes);
    }
    if(prior.phase==='failed'){
     send(session,{type:'retryChapter'});expect(current(session)).toMatchObject({phase:'prepare',node:1,retries:{1:1}});
     expect(current(session).failedAttempts).toHaveLength(1);
    }
    expect(session.startNewGame(input,decision(session,true)).ok).toBe(true);
    expect(current(session)).toMatchObject({runId:input.runId,seed:input.seed,revision:0,node:1,lamp:8,coins:4,tool:null,journal:[],failedAttempts:[],ending:null});
    expect(session.startNewGame(input,{generation:snapshot.generation,confirmed:true})).toMatchObject({ok:false,error:'stale_session'});
    if(prior.phase==='ending')expect(decodeV7Save(store.getItem(V7_BACKUP_KEY))).toMatchObject({status:'valid',state:prior});
   }finally{await session.dispose();}
  }
 });
});
