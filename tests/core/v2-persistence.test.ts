import { afterEach, expect, test } from 'vitest';
import { createAdaptedSession } from '../../src/application/persistent-session.js';
import type { RuleAdapter } from '../../src/application/persistent-session.js';
import { createV2SaveRepository, decodeV2Save, V2_BACKUP_KEY, V2_SAVE_KEY } from '../../src/application/v2-persistence.js';
import { createWriterLease, WRITER_LOCK } from '../../src/platform/writer-lease.js';
import { SAVE_KEY, decodeSave } from '../../src/platform/storage.js';
import { createRun, applyCommand } from '../../src/core-v2/index.js';
import type { Action, CreateRunInput, DomainEvent, ErrorCode, RunState } from '../../src/core-v2/index.js';
import { MemoryStorage, TestLocks, session as legacySession, decision as legacyDecision, command as legacyCommand } from './persistence-fixtures';

class DualStorage extends MemoryStorage {
  failV2=false;
  override setItem(key:string,value:string){if(this.failV2&&key===V2_SAVE_KEY)throw Error('V2 quota');super.setItem(key,value);}
}
const opened:{dispose():Promise<void>}[]=[];
const rules:RuleAdapter<RunState,CreateRunInput,ErrorCode,DomainEvent>={createRun,applyCommand};
function open(storage=new DualStorage(),locks=new TestLocks()){
  const port=createAdaptedSession(createV2SaveRepository(()=>storage,()=> '2026-10-19T02:00:00.000Z'),createWriterLease(locks),rules);opened.push(port);return port;
}
type Port=ReturnType<typeof open>;
function start(port:Port){return port.startNewGame({runId:'persistent-v2',seed:'save-v2'},{generation:port.getSnapshot().generation,confirmed:false});}
function send(port:Port,action:Action){const s=port.getSnapshot();if(!s.state)throw Error('no run');return port.dispatch({runId:s.state.runId,expectedRevision:s.state.revision,action},s.generation);}
afterEach(async()=>{await Promise.all(opened.splice(0).map(p=>p.dispose()));});

test('v2 writes schema2, keeps v1 bytes, and all domains use the shared single-writer lease',async()=>{
  const storage=new DualStorage(),locks=new TestLocks(),old=legacySession(storage,locks);opened.push(old);
  await old.activate();old.startNewGame({runId:'legacy',seed:'legacy'},legacyDecision(old));legacyCommand(old,{type:'strike',pieceId:'1:1',mode:'standard',timingMark:5000});const legacy=storage.getItem(SAVE_KEY);
  const port=open(storage,locks);expect((await port.activate()).mode).toBe('readonly');expect(start(port)).toMatchObject({ok:false,error:'readonly'});
  await old.suspend();await port.activate();expect(start(port).ok).toBe(true);expect(send(port,{type:'chooseTechnique',techniqueId:'bridgeClip'}).ok).toBe(true);expect(send(port,{type:'chooseRequest',requestId:'1:guard'}).ok).toBe(true);expect(send(port,{type:'strike',pieceId:'1:1',node:0,mode:'standard',timingMark:5000}).ok).toBe(true);
  expect(storage.getItem(SAVE_KEY)).toBe(legacy);expect(decodeSave(legacy).status).toBe('valid');expect(decodeV2Save(legacy)).toMatchObject({status:'invalid',error:'unsupported_schema'});
  const raw=storage.getItem(V2_SAVE_KEY);if(!raw)throw Error('save');expect(JSON.parse(raw)).toMatchObject({schemaVersion:2,rulesVersion:'forge-v2'});expect(decodeV2Save(raw)).toMatchObject({status:'valid',state:port.getSnapshot().state});expect(decodeSave(raw)).toMatchObject({status:'invalid',error:'unsupported_schema'});
  const exact=port.getSnapshot().state;await port.suspend();const reopened=open(storage,locks);expect((await reopened.activate()).state).toEqual(exact);
  expect(locks.requests.every(r=>r.name===WRITER_LOCK)).toBe(true);
});

test('v2 failed primary writes preserve accepted work and retry without changing the v1 slot',async()=>{
  const storage=new DualStorage(),port=open(storage);await port.activate();start(port);send(port,{type:'chooseTechnique',techniqueId:'reheatSand'});send(port,{type:'chooseRequest',requestId:null});
  const disk=storage.getItem(V2_SAVE_KEY);storage.failV2=true;const result=send(port,{type:'strike',pieceId:'1:1',node:0,mode:'standard',timingMark:5000});expect(result).toMatchObject({ok:true,persistence:{ok:false,error:'storage_write_failed'}});
  const state=port.getSnapshot().state;expect(port.getSnapshot().dirty).toBe(true);expect(storage.getItem(V2_SAVE_KEY)).toBe(disk);expect(storage.getItem(SAVE_KEY)).toBeNull();
  await port.suspend();await port.activate();expect(port.getSnapshot().state).toBe(state);expect(port.getSnapshot().conflict).toBe(false);
  storage.failV2=false;expect(port.retrySave(port.getSnapshot().generation).ok).toBe(true);expect(decodeV2Save(storage.getItem(V2_SAVE_KEY))).toMatchObject({status:'valid',state});
});

test('backup recovery only restores v2, is explicit, and old generations cannot strike after restore',async()=>{
  const storage=new DualStorage(),port=open(storage);await port.activate();start(port);send(port,{type:'chooseTechnique',techniqueId:'edgeTooth'});send(port,{type:'chooseRequest',requestId:null});
  const before=port.getSnapshot();send(port,{type:'strike',pieceId:'1:1',node:0,mode:'standard',timingMark:5000});const backup=storage.getItem(V2_BACKUP_KEY);
  storage.data.set(V2_SAVE_KEY,'broken JSON');port.notifyExternalChange();expect(port.recoverBackup({generation:port.getSnapshot().generation,confirmed:false})).toMatchObject({ok:false,error:'confirmation_required'});
  expect(port.recoverBackup({generation:port.getSnapshot().generation,confirmed:true}).ok).toBe(true);expect(port.getSnapshot().state).toEqual(before.state);expect(storage.getItem(V2_BACKUP_KEY)).toBe(backup);
  expect(port.dispatch({},before.generation)).toMatchObject({ok:false,error:'stale_session'});expect(storage.getItem(SAVE_KEY)).toBeNull();
});

test('v2 dirty state conflicts with a newer v2 writer and never adopts a changed baseline silently',async()=>{
  const storage=new DualStorage(),locks=new TestLocks(),a=open(storage,locks);await a.activate();start(a);send(a,{type:'chooseTechnique',techniqueId:'bridgeClip'});send(a,{type:'chooseRequest',requestId:null});
  storage.failV2=true;send(a,{type:'strike',pieceId:'1:1',node:0,mode:'standard',timingMark:5000});const dirty=a.getSnapshot().state;await a.suspend();storage.failV2=false;
  const b=open(storage,locks);await b.activate();send(b,{type:'scrap',pieceId:'1:2'});const latest=b.getSnapshot().state;await b.suspend();a.notifyExternalChange();await a.activate();
  expect(a.getSnapshot()).toMatchObject({state:dirty,dirty:true,conflict:true});expect(a.retrySave(a.getSnapshot().generation)).toMatchObject({ok:false,error:'save_conflict'});
  expect(a.resume({generation:a.getSnapshot().generation,confirmed:false})).toMatchObject({ok:false,error:'confirmation_required'});expect(a.resume({generation:a.getSnapshot().generation,confirmed:true}).ok).toBe(true);expect(a.getSnapshot().state).toEqual(latest);
});
