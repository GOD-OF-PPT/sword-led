import {describe,expect,it} from 'vitest';
import {applyCommand,createRun,validateRun} from '../../src/core-v6/index.js';
import type {Action,RunState} from '../../src/core-v6/index.js';
import {createV6Session,createV6SaveRepository,createV6WriterLease,decodeV6Save,V6_SAVE_KEY,V6_BACKUP_KEY,V6_WRITER_LOCK} from '../../src/application/v6-persistence.js';
import type {V6Session} from '../../src/application/v6-persistence.js';
import {WRITER_LOCK} from '../../src/platform/writer-lease.js';
import type {LockHost} from '../../src/platform/writer-lease.js';
import {FIXED_TIME,MemoryStorage,TestLocks,session as legacySession} from './persistence-fixtures.js';

// Every valid run below is reconstructed using the approved v6 public commands.
// Opaque old/future bytes and edited JSON are explicitly negative inputs, not
// fabricated legitimate runs. Exact backup display-source guards belong to UI.
class Store extends MemoryStorage {
 readonly deniedReads=new Set<string>();
 readonly deniedWrites=new Set<string>();
 override getItem(key:string){if(this.deniedReads.has(key))throw Error('Declared storage read refusal');return super.getItem(key);}
 override setItem(key:string,value:string){if(this.deniedWrites.has(key))throw Error('Declared storage write refusal');super.setItem(key,value);}
}
class NamedLocks implements LockHost {
 readonly byName=new Map<string,TestLocks>();
 readonly requests:{name:string;mode:'exclusive';ifAvailable:true}[]=[];
 request(name:string,options:{mode:'exclusive';ifAvailable:true},callback:(lock:object|null)=>Promise<void>){
  this.requests.push({name,...options});let locks=this.byName.get(name);
  if(!locks){locks=new TestLocks();this.byName.set(name,locks);}return locks.request(name,options,callback);
 }
}
function open(store=new Store(),locks:LockHost|undefined=new TestLocks()){
 return createV6Session(createV6SaveRepository(()=>store,()=>FIXED_TIME),createV6WriterLease(locks));
}
const decision=(session:V6Session,confirmed=false)=>({generation:session.getSnapshot().generation,confirmed});
function current(session:V6Session){const state=session.getSnapshot().state;if(!state)throw Error('Missing real v6 run');return state;}
function expected(state:RunState,action:Action){const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(result.error);return result;}
function send(session:V6Session,action:Action){
 const snapshot=session.getSnapshot(),state=current(session),oracle=expected(state,action);
 const result=session.dispatch({runId:state.runId,expectedRevision:state.revision,action},snapshot.generation);
 if(!result.ok)throw Error('Session rejected a legal command: '+result.error);
 expect(result.state).toEqual(oracle.state);expect(result.events).toEqual(oracle.events);expect(current(session)).toEqual(oracle.state);return result;
}
function start(session:V6Session,runId='v6-durable'){
 const result=session.startNewGame({runId,seed:'v6-contract'},decision(session));expect(result.ok).toBe(true);return current(session);
}
function fromCommands(actions:readonly Action[]){
 const made=createRun({runId:'v6-recovered-prefix',seed:'v6-contract'});if(!made.ok)throw Error(made.error);
 let state=made.state;for(const action of actions)state=expected(state,action).state;
 expect(validateRun(state).ok).toBe(true);return state;
}
const mainPrefix:readonly Action[]=[
 {type:'chooseSchool',pieceId:'main-1',school:'steady'},
 ...Array.from({length:4},():Action=>({type:'forge',pieceId:'main-1',useTechnique:false})),
 {type:'forge',pieceId:'main-1',useTechnique:true},{type:'seal',pieceId:'main-1'},
 {type:'guard'},{type:'strike',targetId:'main-guard'},
];
function rawFor(state:RunState){
 const store=new Store(),repository=createV6SaveRepository(()=>store,()=>FIXED_TIME);repository.load();expect(repository.write(state).ok).toBe(true);
 const raw=store.getItem(V6_SAVE_KEY);if(raw===null)throw Error('Formal v6 codec did not write');return raw;
}
function put(store:Store,state:RunState){store.data.set(V6_SAVE_KEY,rawFor(state));}

describe('v6 independent persistent expedition',()=>{
 it('uses schema6 and full-journal validation while preserving all old run, collection and settings bytes',async()=>{
  const store=new Store();
  for(const version of [1,2,3,4,5])for(const slot of ['save','save.backup'])store.data.set(`sword-led.${slot}.v${version}`,`opaque original ${slot} v${version}`);
  for(const key of ['sword-led.collection.v1','sword-led.collection.backup.v1','sword-led.collection.v2','sword-led.collection.backup.v2','sword-led.settings.v1'])store.data.set(key,'opaque original '+key);
  const originals=new Map(store.data),session=open(store);
  try{
   await session.activate();start(session);send(session,{type:'chooseSchool',pieceId:'main-1',school:'steady'});send(session,{type:'forge',pieceId:'main-1',useTechnique:false});
   const exact=current(session),raw=store.getItem(V6_SAVE_KEY)!;
   expect(JSON.parse(raw)).toMatchObject({schemaVersion:6,rulesVersion:'forge-v6',savedAt:FIXED_TIME});
   expect(decodeV6Save(raw)).toMatchObject({status:'valid',state:exact});expect(decodeV6Save(store.getItem(V6_BACKUP_KEY)).status).toBe('valid');
   const forged=JSON.parse(raw);forged.state.coins=15;expect(decodeV6Save(JSON.stringify(forged))).toMatchObject({status:'invalid',error:'invalid_state'});
   const wrong=JSON.parse(raw);wrong.schemaVersion=5;wrong.rulesVersion='forge-v5';expect(decodeV6Save(JSON.stringify(wrong)).status).toBe('invalid');
   for(const[key,value]of originals)expect(store.getItem(key)).toBe(value);
   expect(store.writes.every(key=>key===V6_SAVE_KEY||key===V6_BACKUP_KEY)).toBe(true);
  }finally{await session.dispose();}
 });

 it('maps an independent named v6 writer lock, excludes a second v6 writer and rejects stale generations after ownership changes',async()=>{
  const store=new Store(),locks=new NamedLocks(),old=legacySession(store,locks),first=open(store,locks),second=open(store,locks);
  try{
   expect((await old.activate()).mode).toBe('writer');
   expect((await first.activate()).mode).toBe('writer');start(first);const exact=current(first);
   expect((await second.activate()).mode).toBe('readonly');expect(current(second)).toEqual(exact);
   const readOnly=second.getSnapshot();expect(second.dispatch({runId:exact.runId,expectedRevision:exact.revision,action:{type:'chooseSchool',pieceId:'main-1',school:'steady'}},readOnly.generation)).toMatchObject({ok:false,error:'readonly'});
   const stale=first.getSnapshot();await first.suspend();expect((await second.activate()).mode).toBe('writer');
   expect(first.retrySave(stale.generation)).toMatchObject({ok:false,error:'stale_session'});
   const oldCommand={runId:exact.runId,expectedRevision:exact.revision,action:{type:'chooseSchool',pieceId:'main-1',school:'steady'}};
   expect(second.dispatch(oldCommand,readOnly.generation)).toMatchObject({ok:false,error:'stale_session'});
   send(second,{type:'chooseSchool',pieceId:'main-1',school:'steady'});
   expect(locks.requests.some(request=>request.name===WRITER_LOCK)).toBe(true);expect(locks.requests.filter(request=>request.name===V6_WRITER_LOCK).length).toBeGreaterThanOrEqual(3);
   expect(V6_WRITER_LOCK).not.toBe(WRITER_LOCK);expect(locks.requests.every(request=>request.mode==='exclusive'&&request.ifAvailable)).toBe(true);
  }finally{await first.dispose();await second.dispose();await old.dispose();}
 });

 it('preserves an Accepted result and RNG exactly through a failed main write and a save-only retry',async()=>{
  const store=new Store(),session=open(store);
  try{
   await session.activate();start(session);send(session,{type:'chooseSchool',pieceId:'main-1',school:'steady'});
   const before=current(session),disk=store.getItem(V6_SAVE_KEY);store.deniedWrites.add(V6_SAVE_KEY);
   const accepted=send(session,{type:'forge',pieceId:'main-1',useTechnique:false}),exact=current(session);
   expect(accepted).toMatchObject({ok:true,persistence:{ok:false,error:'storage_write_failed'}});expect(session.getSnapshot()).toMatchObject({dirty:true,conflict:false});
   expect(exact.rng.forge.draws).toBe(before.rng.forge.draws+1);expect(store.getItem(V6_SAVE_KEY)).toBe(disk);
   expect(session.retrySave(session.getSnapshot().generation).ok).toBe(false);expect(current(session)).toBe(exact);
   store.deniedWrites.clear();expect(session.retrySave(session.getSnapshot().generation).ok).toBe(true);expect(current(session)).toBe(exact);
   expect(session.getSnapshot().dirty).toBe(false);expect(decodeV6Save(store.getItem(V6_SAVE_KEY))).toMatchObject({status:'valid',state:exact});
   expect(current(session).journal).toEqual([...before.journal,{type:'forge',pieceId:'main-1',useTechnique:false}]);
  }finally{await session.dispose();}
 });

 it('reports a backup write warning separately from a safely written main result',async()=>{
  const store=new Store(),session=open(store);
  try{
   await session.activate();start(session);send(session,{type:'chooseSchool',pieceId:'main-1',school:'steady'});
   const backup=store.getItem(V6_BACKUP_KEY);store.deniedWrites.add(V6_BACKUP_KEY);
   const accepted=send(session,{type:'forge',pieceId:'main-1',useTechnique:false});
   expect(accepted).toMatchObject({ok:true,persistence:{ok:true,backupWarning:true}});expect(session.getSnapshot().dirty).toBe(false);
   expect(decodeV6Save(store.getItem(V6_SAVE_KEY))).toMatchObject({status:'valid',state:current(session)});expect(store.getItem(V6_BACKUP_KEY)).toBe(backup);
  }finally{await session.dispose();}
 });

 it('uses an explicitly selected memory run without changing disk slots and exports only current legal state',async()=>{
  const store=new Store(),session=open(store);
  try{
   await session.activate();start(session);send(session,{type:'chooseSchool',pieceId:'main-1',school:'steady'});
   const disk=new Map(store.data),writes=store.writes.length,exact=current(session);
   expect(session.useMemory({runId:'unconfirmed-replacement',seed:'v6-contract'},decision(session)).ok).toBe(false);expect(current(session)).toBe(exact);
   expect(session.useMemory(null,decision(session,true)).ok).toBe(true);expect(session.getSnapshot().mode).toBe('memory');
   const accepted=send(session,{type:'forge',pieceId:'main-1',useTechnique:false});expect(accepted.persistence).toBeNull();expect(session.retrySave(session.getSnapshot().generation)).toMatchObject({ok:false,error:'save_unavailable'});
   const exported=session.exportRun();expect(exported).not.toBeNull();expect(validateRun(JSON.parse(exported!))).toMatchObject({ok:true,state:current(session)});
   expect(store.data).toEqual(disk);expect(store.writes).toHaveLength(writes);
  }finally{await session.dispose();}
 });

 it('never replaces unknown future main bytes during activation or an unconfirmed new-run request',async()=>{
  const store=new Store(),future='{"schemaVersion":99,"rulesVersion":"future-forge","savedAt":"2026-10-23T00:00:00.000Z","state":{"future":true}}';
  store.data.set(V6_SAVE_KEY,future);const session=open(store);
  try{
   const activated=await session.activate();expect(activated.load?.main).toMatchObject({status:'invalid',error:'unsupported_schema'});expect(activated.state).toBeNull();expect(session.exportRun()).toBeNull();
   expect(session.startNewGame({runId:'replacement',seed:'v6-contract'},decision(session))).toMatchObject({ok:false,error:'confirmation_required'});
   expect(store.getItem(V6_SAVE_KEY)).toBe(future);expect(store.writes).toEqual([]);
  }finally{await session.dispose();}
 });

 it('requires confirmation to recover a currently valid v6 backup and refuses to overwrite a valid main',async()=>{
  const recovered=fromCommands(mainPrefix),store=new Store();store.data.set(V6_BACKUP_KEY,rawFor(recovered));store.data.set(V6_SAVE_KEY,'{broken original');
  const session=open(store);
  try{
   await session.activate();const old=session.getSnapshot(),original=store.getItem(V6_SAVE_KEY);
   expect(session.recoverBackup(decision(session))).toMatchObject({ok:false,error:'confirmation_required'});expect(store.getItem(V6_SAVE_KEY)).toBe(original);expect(store.writes).toEqual([]);
   expect(session.recoverBackup(decision(session,true)).ok).toBe(true);expect(current(session)).toEqual(recovered);expect(session.getSnapshot().generation).toBeGreaterThan(old.generation);
   expect(decodeV6Save(store.getItem(V6_SAVE_KEY))).toMatchObject({status:'valid',state:recovered});
   expect(session.recoverBackup(decision(session,true))).toMatchObject({ok:false,error:'main_available'});
   expect(session.resume({generation:old.generation,confirmed:true})).toMatchObject({ok:false,error:'stale_session'});
   // This session command confirms the current backup; a later UI must also bind
   // the exact bytes displayed before asking the player to confirm a source.
  }finally{await session.dispose();}
 });

 it('keeps refused reads and external source conflicts distinct from an empty slot or permission to overwrite',async()=>{
  const store=new Store(),session=open(store);store.deniedReads.add(V6_SAVE_KEY);
  try{
   await session.activate();expect(session.getSnapshot().load?.main).toMatchObject({status:'unavailable',error:'storage_read_failed'});
   expect(session.startNewGame({runId:'blocked-read',seed:'v6-contract'},decision(session,true))).toMatchObject({ok:false,error:'save_unavailable'});expect(store.writes).toEqual([]);
   store.deniedReads.clear();await session.activate();start(session);const before=current(session),generation=session.getSnapshot().generation;
   store.data.set(V6_SAVE_KEY,rawFor(fromCommands(mainPrefix)));session.notifyExternalChange();
   expect(session.getSnapshot().conflict).toBe(true);expect(current(session)).toBe(before);expect(session.retrySave(generation)).toMatchObject({ok:false,error:'stale_session'});
   const action={type:'chooseSchool',pieceId:'main-1',school:'steady'};expect(session.dispatch({runId:before.runId,expectedRevision:before.revision,action},session.getSnapshot().generation)).toMatchObject({ok:false,error:'save_conflict'});
   expect(store.getItem(V6_SAVE_KEY)).toBe(rawFor(fromCommands(mainPrefix)));
  }finally{await session.dispose();}
 });

 it('blocks subscriber command reentry so one Accepted result, disk snapshot and returned state stay identical',async()=>{
  const store=new Store(),session=open(store);let armed=false,attempted=false,nested:unknown=null;
  const stop=session.subscribe(snapshot=>{
   if(!armed||attempted||!snapshot.state)return;attempted=true;
   nested=session.dispatch({runId:snapshot.state.runId,expectedRevision:snapshot.state.revision,action:{type:'forge',pieceId:'main-1',useTechnique:false}},snapshot.generation);
  });
  try{
   await session.activate();start(session);const before=current(session),initialRaw=store.getItem(V6_SAVE_KEY);let initialReentry:unknown=null;
   const stopInitial=session.subscribe(()=>{initialReentry=session.useMemory(null,decision(session,true));});stopInitial();
   expect(initialReentry).toMatchObject({ok:false,error:'session_busy'});expect(session.getSnapshot().mode).toBe('writer');expect(store.getItem(V6_SAVE_KEY)).toBe(initialRaw);armed=true;
   const accepted=send(session,{type:'chooseSchool',pieceId:'main-1',school:'steady'});
   expect(attempted).toBe(true);expect(nested).toMatchObject({ok:false,error:'session_busy'});expect(current(session).journal).toHaveLength(before.journal.length+1);
   expect(decodeV6Save(store.getItem(V6_SAVE_KEY))).toMatchObject({status:'valid',state:accepted.state});
  }finally{stop();await session.dispose();}
 });

 it('restores an actually paid gate and earned tool without replaying payment, cache grant or an accepted action',async()=>{
  const earned=fromCommands([...mainPrefix,{type:'takeCache',target:'rope'}]),store=new Store();put(store,earned);const raw=store.getItem(V6_SAVE_KEY),writes=store.writes.length;
  const session=open(store);
  try{
   await session.activate();expect(current(session)).toEqual(earned);expect(current(session)).toMatchObject({coins:15,gatePaid:true,gateCleared:true,tool:'rebound',phase:'echo-forge'});
   expect(session.resume(decision(session)).ok).toBe(true);expect(current(session)).toEqual(earned);expect(store.getItem(V6_SAVE_KEY)).toBe(raw);expect(store.writes).toHaveLength(writes);
   for(const action of [{type:'strike',targetId:'main-guard'},{type:'takeCache',target:'rope'}]){
    const snapshot=session.getSnapshot(),result=session.dispatch({runId:earned.runId,expectedRevision:earned.revision,action},snapshot.generation);
    expect(result.ok).toBe(false);expect(result.events).toEqual([]);expect(current(session)).toEqual(earned);
   }
   const exported=session.exportRun();expect(JSON.parse(exported!)).toEqual(earned);expect(store.writes).toHaveLength(writes);
   for(const action of [{type:'chooseSchool',pieceId:'echo-1',school:'steady'},...Array.from({length:3},():Action=>({type:'forge',pieceId:'echo-1',useTechnique:false})),{type:'forge',pieceId:'echo-1',useTechnique:true},{type:'seal',pieceId:'echo-1'},{type:'guard'},{type:'strike',targetId:'echo-primary'},{type:'followUp',targetId:'echo-secondary'}] satisfies readonly Action[])send(session,action);
   const final=current(session);expect(final).toMatchObject({phase:'recap',coins:15,tool:'rebound',echo:{demonstrated:true}});expect(decodeV6Save(store.getItem(V6_SAVE_KEY))).toMatchObject({status:'valid',state:final});
  }finally{await session.dispose();}
  const reopened=open(store);try{await reopened.activate();expect(current(reopened)).toMatchObject({phase:'recap',coins:15,tool:'rebound',echo:{demonstrated:true}});expect(validateRun(current(reopened)).ok).toBe(true);}finally{await reopened.dispose();}
 });
});
