import {createAdaptedSession} from './persistent-session.js';
import type {Decision,PersistentSession,SessionCommandResult,SessionResult,SessionSnapshot} from './persistent-session.js';
import {createAdaptedSaveRepository,decodeStoredSave} from '../platform/storage.js';
import type {SaveCodec,SaveRead,SaveRepository,StorageLike} from '../platform/storage.js';
import {bindBrowserSession} from '../platform/browser-session.js';
import {createWriterLease,WRITER_LOCK} from '../platform/writer-lease.js';
import type {LockHost,WriterLease} from '../platform/writer-lease.js';
import {applyCommand,createRun} from '../core-v7/game.js';
import {validateRun} from '../core-v7/validation.js';
import type {CreateRunInput,DomainEvent,ErrorCode,RunState} from '../core-v7/model.js';

export const V7_SAVE_KEY='sword-led.save.v7';
export const V7_BACKUP_KEY='sword-led.save.backup.v7';
export const V7_WRITER_LOCK='sword-led.writer.v7';
export const V7_CODEC:SaveCodec<RunState>=Object.freeze({
  key:V7_SAVE_KEY,backupKey:V7_BACKUP_KEY,schemaVersion:7,rulesVersion:'forge-v7',validate:validateRun,
});

export type V7NewGameInput=CreateRunInput;
export type V7ApplicationError=ErrorCode|'session_busy';
export type V7SessionSnapshot=SessionSnapshot<RunState>;
export type V7SessionResult=SessionResult<RunState,V7ApplicationError>;
export type V7SessionCommandResult=SessionCommandResult<RunState,V7ApplicationError,DomainEvent>;
export type V7SaveRead=SaveRead<RunState>;
export type V7SaveRepository=SaveRepository<RunState>;
export type V7Decision=Decision;
export type {Decision,SessionError,SessionMode} from './persistent-session.js';

export const decodeV7Save=(raw:string|null):V7SaveRead=>decodeStoredSave(raw,V7_CODEC);
export const createV7SaveRepository=(storage:()=>StorageLike,now?:()=>string):V7SaveRepository=>
  createAdaptedSaveRepository(storage,V7_CODEC,now);

/** V7 windows share one lease without taking the writer slot of any older version. */
export function createV7WriterLease(host?:LockHost):WriterLease {
  const namespaced:LockHost|undefined=host?{
    request:(name,options,callback)=>host.request(name===WRITER_LOCK?V7_WRITER_LOCK:name,options,callback),
  }:undefined;
  return createWriterLease(namespaced);
}

export interface V7Session extends PersistentSession<RunState,V7NewGameInput,V7ApplicationError,DomainEvent> {
  /** Retains the exact current Accepted state, including dirty or memory-only progress. */
  exportRun():string|null;
}

export function createV7Session(repository:V7SaveRepository,lease:WriterLease):V7Session {
  const inner=createAdaptedSession<RunState,V7NewGameInput,V7ApplicationError,DomainEvent>(repository,lease,{
    // A completed journey is still the player's record. Failed journeys also
    // retain their chapter retry, so replacing either requires confirmation.
    createRun,applyCommand,isTerminal:()=>false,
  });
  let busy=false,publishing=0,disposed=false;
  let disposeResult:Promise<void>|null=null;
  const listeners=new Set<(snapshot:V7SessionSnapshot)=>void>();
  const blocked=()=>busy||publishing>0;
  const failBusy=():V7SessionResult=>({ok:false,error:'session_busy',snapshot:inner.getSnapshot()});

  // The lock protects the synchronous mutation and every notification it causes.
  // Async lease completion publishes through the same guarded subscriber below.
  function invoke<T>(operation:()=>T):T {
    busy=true;
    try{return operation();}finally{busy=false;}
  }
  function mutate(operation:()=>V7SessionResult):V7SessionResult {
    return blocked()?failBusy():invoke(operation);
  }
  function deliver(listener:(snapshot:V7SessionSnapshot)=>void,snapshot:V7SessionSnapshot){
    publishing++;
    try{listener(snapshot);}catch{/* A view cannot revoke an Accepted command or its save. */}
    finally{publishing--;}
  }
  const unsubscribe=inner.subscribe(snapshot=>{
    publishing++;
    try{
      for(const listener of [...listeners]){
        if(inner.getSnapshot().generation!==snapshot.generation)break;
        if(listeners.has(listener))deliver(listener,snapshot);
      }
    }finally{publishing--;}
  });

  return{
    getSnapshot:inner.getSnapshot,
    subscribe:listener=>{
      if(!disposed)listeners.add(listener);
      // Initial delivery is a publication too: it must not offer a reentry hole.
      deliver(listener,inner.getSnapshot());
      return()=>{listeners.delete(listener);};
    },
    activate:()=>blocked()?Promise.resolve(inner.getSnapshot()):invoke(()=>inner.activate()),
    startNewGame:(input,decision)=>mutate(()=>inner.startNewGame(input,decision)),
    resume:decision=>mutate(()=>inner.resume(decision)),
    recoverBackup:decision=>mutate(()=>inner.recoverBackup(decision)),
    useMemory:(input,decision)=>mutate(()=>inner.useMemory(input,decision)),
    dispatch:(command,generation):V7SessionCommandResult=>{
      if(blocked()){
        const snapshot=inner.getSnapshot();
        return{ok:false,error:'session_busy',state:snapshot.state,events:[],snapshot};
      }
      return invoke(()=>inner.dispatch(command,generation));
    },
    retrySave:generation=>mutate(()=>inner.retrySave(generation)),
    notifyExternalChange:()=>{
      if(!disposed&&!blocked())invoke(()=>inner.notifyExternalChange());
    },
    exportRun:()=>{
      const state=inner.getSnapshot().state;
      return state?JSON.stringify(state,null,2):null;
    },
    // Browser lifecycle calls occur outside publication. A listener cannot
    // invalidate or dispose the transaction whose result it is receiving.
    suspend:()=>blocked()?Promise.resolve():invoke(()=>inner.suspend()),
    dispose:()=>{
      if(disposed)return disposeResult??Promise.resolve();
      if(blocked())return Promise.resolve();
      return invoke(()=>{
        disposed=true;
        disposeResult=inner.dispose();
        unsubscribe();listeners.clear();
        return disposeResult;
      });
    },
  };
}

export function createV7BrowserSession(target:Window=window):V7Session {
  return bindBrowserSession(target,V7_SAVE_KEY,host=>createV7Session(
    createV7SaveRepository(()=>target.localStorage),createV7WriterLease(host),
  ));
}
