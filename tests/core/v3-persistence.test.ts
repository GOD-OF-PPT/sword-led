import {expect,test} from 'vitest';
import {createAdaptedSession} from '../../src/application/persistent-session.js';
import {createV3SaveRepository,decodeV3Save,V3_SAVE_KEY,V3_BACKUP_KEY} from '../../src/application/v3-persistence.js';
import {createWriterLease} from '../../src/platform/writer-lease.js';
import {createRun,applyCommand} from '../../src/core-v3/index.js';
import {MemoryStorage,TestLocks,session as legacySession,decision as legacyDecision} from './persistence-fixtures';
test('v3 shared writer, schema isolation, dirty retry, backup and stale generations',async()=>{
 class Store extends MemoryStorage{fail=false;override setItem(k:string,v:string){if(this.fail&&k===V3_SAVE_KEY)throw Error('quota');super.setItem(k,v);}}
 const store=new Store(),locks=new TestLocks(),old=legacySession(store,locks);await old.activate();old.startNewGame({runId:'old',seed:'old'},legacyDecision(old));const oldBytes=store.getItem('sword-led.save.v1');
 const open=()=>createAdaptedSession(createV3SaveRepository(()=>store,()=> '2026-10-19T04:00:00.000Z'),createWriterLease(locks),{createRun,applyCommand});const port=open();expect((await port.activate()).mode).toBe('readonly');await old.dispose();await port.activate();
 expect(port.startNewGame({runId:'v3-save',seed:'save',roundLimit:3},{generation:port.getSnapshot().generation,confirmed:false}).ok).toBe(true);
 const s=port.getSnapshot(),c={runId:s.state!.runId,expectedRevision:s.state!.revision,action:{type:'strike',pieceId:'r1-1'}};store.fail=true;const accepted=port.dispatch(c,s.generation);expect(accepted).toMatchObject({ok:true,persistence:{ok:false}});const exact=port.getSnapshot().state;expect(port.getSnapshot().dirty).toBe(true);store.fail=false;expect(port.retrySave(s.generation).ok).toBe(true);expect(port.getSnapshot().state).toBe(exact);expect(decodeV3Save(store.getItem(V3_SAVE_KEY))).toMatchObject({status:'valid',state:exact});expect(store.getItem('sword-led.save.v1')).toBe(oldBytes);expect(store.getItem('sword-led.save.v2')).toBeNull();
 const raw=store.getItem(V3_SAVE_KEY)!;expect(JSON.parse(raw).schemaVersion).toBe(3);await port.dispose();const reopen=open();await reopen.activate();expect(reopen.getSnapshot().state).toEqual(exact);const before=reopen.getSnapshot();store.data.set(V3_SAVE_KEY,'{broken');reopen.notifyExternalChange();expect(reopen.recoverBackup({generation:reopen.getSnapshot().generation,confirmed:false}).ok).toBe(false);expect(reopen.recoverBackup({generation:reopen.getSnapshot().generation,confirmed:true}).ok).toBe(true);expect(store.getItem(V3_BACKUP_KEY)).not.toBeNull();expect(reopen.dispatch(c,before.generation)).toMatchObject({ok:false,error:'stale_session'});await reopen.dispose();
});
