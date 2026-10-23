import {createAdaptedSession} from './persistent-session.js';
import type {Decision,PersistentSession,SessionCommandResult,SessionResult,SessionSnapshot} from './persistent-session.js';
import {createAdaptedSaveRepository,decodeStoredSave} from '../platform/storage.js';
import type {SaveCodec,SaveRead,SaveRepository,StorageLike} from '../platform/storage.js';
import {bindBrowserSession} from '../platform/browser-session.js';
import {createWriterLease,WRITER_LOCK} from '../platform/writer-lease.js';
import type {LockHost,WriterLease} from '../platform/writer-lease.js';
import {applyCommand,createRun,validateRun} from '../core-v6/index.js';
import type {CreateRunInput,DomainEvent,ErrorCode,RunState} from '../core-v6/index.js';

export const V6_SAVE_KEY='sword-led.save.v6';
export const V6_BACKUP_KEY='sword-led.save.backup.v6';
export const V6_WRITER_LOCK='sword-led.writer.v6';
export const V6_CODEC:SaveCodec<RunState>=Object.freeze({
  key:V6_SAVE_KEY,backupKey:V6_BACKUP_KEY,schemaVersion:6,rulesVersion:'forge-v6',validate:validateRun,
});

export type V6NewGameInput=CreateRunInput;
export type V6ApplicationError=ErrorCode|'session_busy';
export type V6SessionSnapshot=SessionSnapshot<RunState>;
export type V6SessionResult=SessionResult<RunState,V6ApplicationError>;
export type V6SessionCommandResult=SessionCommandResult<RunState,V6ApplicationError,DomainEvent>;
export type V6SaveRead=SaveRead<RunState>;
export type V6SaveRepository=SaveRepository<RunState>;
export type V6Decision=Decision;
export type {Decision,SessionError,SessionMode} from './persistent-session.js';

export const decodeV6Save=(raw:string|null):V6SaveRead=>decodeStoredSave(raw,V6_CODEC);
export const createV6SaveRepository=(storage:()=>StorageLike,now?:()=>string):V6SaveRepository=>
  createAdaptedSaveRepository(storage,V6_CODEC,now);

/** V6 windows share one lease without taking the writer slot of a V5 window. */
export function createV6WriterLease(host?:LockHost):WriterLease {
  const namespaced:LockHost|undefined=host?{
    request:(name,options,callback)=>host.request(name===WRITER_LOCK?V6_WRITER_LOCK:name,options,callback),
  }:undefined;
  return createWriterLease(namespaced);
}

export interface V6Session extends PersistentSession<RunState,V6NewGameInput,V6ApplicationError,DomainEvent> {
  /** Retains the exact current Accepted state, including dirty or memory-only progress. */
  exportRun():string|null;
}

export function createV6Session(repository:V6SaveRepository,lease:WriterLease):V6Session {
  const inner=createAdaptedSession<RunState,V6NewGameInput,V6ApplicationError,DomainEvent>(repository,lease,{
    createRun,applyCommand,isTerminal:state=>state.phase==='recap'||state.phase==='failed',
  });
  let busy=false,publishing=0,disposed=false;
  let disposeResult:Promise<void>|null=null;
  const listeners=new Set<(snapshot:V6SessionSnapshot)=>void>();
  const blocked=()=>busy||publishing>0;
  const failBusy=():V6SessionResult=>({ok:false,error:'session_busy',snapshot:inner.getSnapshot()});

  // The lock protects the synchronous mutation and every notification it causes.
  // Async lease completion publishes through the same guarded subscriber below.
  function invoke<T>(operation:()=>T):T {
    busy=true;
    try{return operation();}finally{busy=false;}
  }
  function mutate(operation:()=>V6SessionResult):V6SessionResult {
    return blocked()?failBusy():invoke(operation);
  }
  function deliver(listener:(snapshot:V6SessionSnapshot)=>void,snapshot:V6SessionSnapshot){
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
    dispatch:(command,generation):V6SessionCommandResult=>{
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

export function createV6BrowserSession(target:Window=window):V6Session {
  return bindBrowserSession(target,V6_SAVE_KEY,host=>createV6Session(
    createV6SaveRepository(()=>target.localStorage),createV6WriterLease(host),
  ));
}
