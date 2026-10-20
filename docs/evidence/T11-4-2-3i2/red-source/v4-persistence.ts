import {createAdaptedSession} from './persistent-session.js';
import type {PersistentSession,SessionSnapshot,SessionResult,SessionCommandResult,Decision} from './persistent-session.js';
import {createAdaptedSaveRepository,decodeStoredSave} from '../platform/storage.js';
import type {SaveCodec,SaveRepository,SaveReport,SaveWrite,SaveError,StorageLike} from '../platform/storage.js';
import {bindBrowserSession} from '../platform/browser-session.js';
import {createWriterLease} from '../platform/writer-lease.js';
import type {WriterLease} from '../platform/writer-lease.js';
import {createRun,applyCommand,validateRun} from '../core-v4/index.js';
import type {RunState,ErrorCode,DomainEvent,CreateRunInput} from '../core-v4/index.js';
import {freezeDeep} from '../core/immutable.js';
import {canonicalJson} from '../core/validate.js';
import {isRecord} from '../core/guards.js';
import {awardsForTrustedRun,collectionEligibility,emptyCollection,mergeCollections,createCollectionRepository,COLLECTION_KEY,COLLECTION_BACKUP_KEY} from './v4-collection.js';
import type {CollectionState,CollectionRepository} from './v4-collection.js';

export const V4_SAVE_KEY='sword-led.save.v4',V4_BACKUP_KEY='sword-led.save.backup.v4';
export const V4_CODEC:SaveCodec<RunState>=Object.freeze({key:V4_SAVE_KEY,backupKey:V4_BACKUP_KEY,schemaVersion:4,rulesVersion:'forge-v4',validate:validateRun});
export const decodeV4Save=(raw:string|null)=>decodeStoredSave(raw,V4_CODEC);
export const createV4SaveRepository=(storage:()=>StorageLike,now?:()=>string)=>createAdaptedSaveRepository(storage,V4_CODEC,now);
export type V4NewGameInput=Pick<CreateRunInput,'runId'|'seed'|'mode'>;
export type V4ApplicationError=ErrorCode|'collection_pending'|'collection_unavailable'|'session_busy';
export interface CollectionSnapshot {
  readonly data:CollectionState;readonly load:SaveReport<CollectionState>|null;
  readonly pending:boolean;readonly lastSave:SaveWrite|null;
  readonly problem:SaveError|'recovery_required'|'run_unsaved'|'run_changed'|null;
  readonly writable:boolean;
}
type Result=SessionResult<RunState,V4ApplicationError>;
export interface V4Session extends PersistentSession<RunState,V4NewGameInput,V4ApplicationError,DomainEvent> {
  getCollectionSnapshot():CollectionSnapshot;
  subscribeCollection(listener:(value:CollectionSnapshot)=>void):()=>void;
  retryCollection(generation:number):Result;
  recoverCollectionBackup(decision:Decision):Result;
  notifyCollectionChange():void;
  exportRun():string|null;
  exportCollection():string;
}

export function createV4Session(repository:SaveRepository<RunState>,lease:WriterLease,collections:CollectionRepository):V4Session {
  let data=emptyCollection(),load:SaveReport<CollectionState>|null=null,lastSave:SaveWrite|null=null;
  let pending=false,problem:CollectionSnapshot['problem']=null,disposed=false,busy=false,publishing=false;
  const listeners=new Set<(s:SessionSnapshot<RunState>)=>void>();
  const collectionListeners=new Set<(s:CollectionSnapshot)=>void>();
  const inner=createAdaptedSession<RunState,V4NewGameInput,V4ApplicationError,DomainEvent>(repository,lease,{
    createRun:input=>{
      const encoded=canonicalJson(input);if(!encoded)return {ok:false,error:'invalid_command'};
      const v:unknown=JSON.parse(encoded);if(!isRecord(v)||Object.keys(v).some(k=>!['runId','seed','mode'].includes(k)))return {ok:false,error:'invalid_command'};
      const eligibility=collectionEligibility(load?.main.status==='valid'?load.main.state:emptyCollection());
      return createRun({...input,eligibility});
    },applyCommand,isTerminal:s=>['victory','return','defeat'].includes(s.phase),
  });
  const writable=(s=inner.getSnapshot())=>!disposed&&s.mode==='writer'&&s.active&&!s.dirty&&!s.conflict&&lease.owns()&&repository.isCurrent();
  const getCollectionSnapshot=():CollectionSnapshot=>freezeDeep({data,load,pending,lastSave,problem,writable:writable()});
  const fail=(error:V4ApplicationError|'stale_session'|'not_active'|'readonly'|'disposed'|'confirmation_required'|'main_available'|'backup_unavailable'):Result=>({ok:false,error,snapshot:inner.getSnapshot()});
  const permission=(generation:number)=>{
    const s=inner.getSnapshot();
    return disposed?'disposed' as const:generation!==s.generation?'stale_session' as const:!s.active?'not_active' as const:s.mode!=='writer'||!lease.owns()?'readonly' as const:null;
  };
  function refresh(sync=true) {
    if(disposed)return;
    const s=inner.getSnapshot();load=collections.load();
    const main=load.main,disk=main.status==='valid'?main.state:emptyCollection();
    data=mergeCollections(data,disk);
    if(writable(s)&&s.state)data=mergeCollections(data,awardsForTrustedRun(s.state));
    const changed=canonicalJson(data)!==canonicalJson(disk);pending=changed;
    problem=main.status==='invalid'||main.status==='unavailable'?main.error:main.status==='empty'&&load.backup.status==='valid'?'recovery_required':null;
    if(!changed||problem!==null||!sync)return;
    if(s.dirty){problem='run_unsaved';return;}
    if(!writable(s)){if(s.active&&s.mode==='writer'&&!repository.isCurrent())problem='run_changed';return;}
    // Read, merge and write happen synchronously under the same lease as the run save.
    lastSave=collections.write(data,{raw:collections.token()});
    pending=!lastSave.ok;
    if(!lastSave.ok)problem=lastSave.error;
    else load={main:{status:'valid',state:data,savedAt:lastSave.savedAt},backup:collections.inspect().backup};
  }
  function publish() {
    if(publishing||disposed)return;publishing=true;
    const s=inner.getSnapshot(),c=getCollectionSnapshot();
    try{
      for(const f of listeners){if(disposed||inner.getSnapshot().generation!==s.generation)break;try{f(s);}catch{/* Consumers cannot revoke a saved result. */}}
      for(const f of collectionListeners){if(disposed||inner.getSnapshot().generation!==s.generation)break;try{f(c);}catch{/* Keep both saves independent of rendering failures. */}}
    }finally{publishing=false;}
  }
  function mutate(fn:()=>Result):Result {
    if(busy||publishing)return fail('session_busy');busy=true;
    try{return fn();}finally{busy=false;}
  }
  const unsubscribe=inner.subscribe(()=>{refresh();publish();});
  const session:V4Session={
    getSnapshot:inner.getSnapshot,getCollectionSnapshot,
    subscribe:f=>{listeners.add(f);try{f(inner.getSnapshot());}catch{/* Optional view. */}return()=>{listeners.delete(f);};},
    subscribeCollection:f=>{collectionListeners.add(f);try{f(getCollectionSnapshot());}catch{/* Optional view. */}return()=>{collectionListeners.delete(f);};},
    activate:async()=>{
      if(busy||publishing)return inner.getSnapshot();
      return inner.activate();
    },
    startNewGame:(input,decision)=>mutate(()=>{
      const denied=permission(decision.generation);
      if(denied&&inner.getSnapshot().mode!=='memory')return fail(denied);
      if(decision.generation!==inner.getSnapshot().generation)return fail('stale_session');
      refresh();
      if(inner.getSnapshot().mode!=='memory'&&pending)return fail('collection_pending');
      return inner.startNewGame(input,decision);
    }),
    resume:decision=>mutate(()=>inner.resume(decision)),
    recoverBackup:decision=>mutate(()=>inner.recoverBackup(decision)),
    useMemory:(input,decision)=>mutate(()=>{refresh(false);return inner.useMemory(input,decision);}),
    dispatch:(command,generation):SessionCommandResult<RunState,V4ApplicationError,DomainEvent>=>{
      if(busy||publishing)return {ok:false,error:'session_busy',state:inner.getSnapshot().state,events:[],snapshot:inner.getSnapshot()};
      busy=true;try{return inner.dispatch(command,generation);}finally{busy=false;}
    },
    retrySave:generation=>mutate(()=>inner.retrySave(generation)),
    retryCollection:generation=>mutate(()=>{
      const denied=permission(generation);if(denied)return fail(denied);
      refresh();publish();return pending||problem?fail('collection_unavailable'):{ok:true,snapshot:inner.getSnapshot()};
    }),
    recoverCollectionBackup:decision=>mutate(()=>{
      const denied=permission(decision.generation);if(denied)return fail(denied);
      if(!decision.confirmed)return fail('confirmation_required');
      load=collections.load();
      if(load.main.status==='valid')return fail('main_available');
      if(load.main.status==='unavailable'||load.backup.status!=='valid')return fail('backup_unavailable');
      if(!writable())return fail('collection_unavailable');
      data=mergeCollections(data,load.backup.state);
      const s=inner.getSnapshot();if(s.state)data=mergeCollections(data,awardsForTrustedRun(s.state));
      lastSave=collections.write(data,{raw:collections.token()});pending=!lastSave.ok;problem=lastSave.ok?null:lastSave.error;
      if(lastSave.ok)load={main:{status:'valid',state:data,savedAt:lastSave.savedAt},backup:collections.inspect().backup};
      publish();return lastSave.ok?{ok:true,snapshot:inner.getSnapshot()}:fail('collection_unavailable');
    }),
    notifyExternalChange:()=>{if(!disposed)inner.notifyExternalChange();},
    notifyCollectionChange:()=>{if(disposed||busy||publishing)return;refresh();publish();},
    exportRun:()=>{const state=inner.getSnapshot().state;return state?JSON.stringify(state,null,2):null;},
    exportCollection:()=>JSON.stringify({format:'sword-led.collection-export.v1',collection:data,stored:collections.readRaw()},null,2),
    suspend:()=>inner.suspend(),
    dispose:()=>{disposed=true;unsubscribe();listeners.clear();collectionListeners.clear();return inner.dispose();},
  };
  return session;
}

export function createV4BrowserSession(target:Window=window):V4Session {
  const session=bindBrowserSession(target,V4_SAVE_KEY,host=>createV4Session(createV4SaveRepository(()=>target.localStorage),createWriterLease(host),createCollectionRepository(()=>target.localStorage)));
  const onCollection=(event:StorageEvent)=>{if(event.key===COLLECTION_KEY||event.key===COLLECTION_BACKUP_KEY||event.key===null)session.notifyCollectionChange();};
  target.addEventListener('storage',onCollection);
  return {...session,dispose:()=>{target.removeEventListener('storage',onCollection);return session.dispose();}};
}
